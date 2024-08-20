import Axios from 'axios'
const _ = require('lodash')
import { LLMServices } from "../services/llm"
import { ChatThreadResult, SearchService, SearchTypes } from "../services/search"
import { VeridaService } from './veridaService'
import { SchemaEmail, SchemaEmailType, SchemaSocialChatMessage } from '../schemas'

const llm = LLMServices.bedrock

const MAX_EMAIL_LENGTH = 500
const MAX_ATTACHMENT_LENGTH = 1000
const MAX_CONTEXT_LENGTH = 20000

// "You are a personal assistant with the ability to search the following categories; emails, chat_history and documents. You receive a prompt and generate a JSON response (with no other text) that provides search queries that will source useful information to help answer the prompt. Search queries for each category should contain three properties; \"terms\" (an array of 10 individual words), \"beforeDate\" (results must be before this date), \"afterDate\" (results must be after this date), \"resultType\" (either \"count\" to count results or \"results\" to return the search results), \"filter\" (an array of key, value pairs of fields to filter the results). Categories can be empty if not relevant to the prompt. The current date is 2024-08-12.\n\nHere is an example JSON response:\n{\"email\": {\"terms\": [\"golf\", \"tennis\", \"soccer\"], \"beforeDate\": \"2024-06-01\", \"afterDate\": \"2024-01-10\" \"filter\": {\"from\": \"dave\"}, \"resultType\": \"results}}\n\nHere is the prompt:\nWhat subscriptions do I currently pay for?"

export class PromptService extends VeridaService {

    public async personalPrompt(prompt: string): Promise<{
        result: any[],
        duration: number,
        keywords: string[],
        entities: string[]
    }> {
        const start = Date.now()
        // Get queries that can help answer the prompt
        //const queryPrompt = `Generate 10 lucene search queries, include reasonable synonyms, to find relevant emails to help respond to this prompt:\n${prompt}\nYou have the following searchable fields: subject,messageText,fromName,fromEmail.\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
        const keywordPrompt = `Generate 10 individual words that could help search for relevant emails realated to this prompt:\n${prompt}\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
        const keywordResponse = await llm(keywordPrompt)
        const entityPrompt = `Extract any individual or organization names mentioned in this prompt:\n${prompt}\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
        const entityResponse = await llm(entityPrompt)

        console.log(keywordResponse)
        console.log(entityResponse)
        const keywords = JSON.parse(keywordResponse)
        let entities = []
        try {
            entities = JSON.parse(entityResponse)
        } catch (err) {
            // do nothing
        }

        console.log(keywords)
        console.log(entities)

        const searchService = new SearchService(this.did, this.context)
        const messages = await searchService.emails(keywords.concat(entities), 20)
        const chatThreads = await searchService.chatThreads(keywords.concat(entities), 10, 10)

        let finalPrompt = `Answer this prompt:\n${prompt}\nHere are some recent messages that may help you provide a relevant answer.\n`
        let contextString = ''

        let maxChatMessages = 50
        for (const chatThread of chatThreads) {
            for (const chatMessage of chatThread.messages) {
                contextString += `From: ${chatMessage.fromName} <${chatMessage.fromHandle}> (${chatMessage.groupName})\nBody: ${chatMessage.messageText}\n\n`

                if (maxChatMessages-- <= 0) {
                    break
                }
            }
        }

        for (const message of messages) {
            let extraContext = ""
            const email = <SchemaEmail> message
            let body = email.messageText.substring(0, MAX_EMAIL_LENGTH)
            if (email.attachments) {
                for (const attachment of email.attachments) {
                    body += attachment.textContent.substring(0, MAX_ATTACHMENT_LENGTH)
                }
            }

            extraContext = `From: ${email.fromName} <${email.fromEmail}> (${email.name})\nBody: ${body}\n\n`
            if ((extraContext.length + contextString.length + finalPrompt.length) > MAX_CONTEXT_LENGTH) {
                break
            }
            
            contextString += extraContext
        }

        finalPrompt += contextString
        console.log('Running final prompt', finalPrompt.length)
        const finalResponse = await llm(finalPrompt)
        const duration = Date.now() - start

        console.log(contextString)

        return {
            result: finalResponse,
            duration,
            keywords,
            entities
        }
    }

}