import Axios from 'axios'
const _ = require('lodash')
import { defaultModel } from "../llm"
import { PromptSearch, PromptSearchLLMResponse } from "../tools/promptSearch"
import { ChatThreadResult, SearchService, SearchSortType } from "../search"
import { VeridaService } from '../veridaService'
import { SchemaEmail, SchemaEmailType, SchemaSocialChatMessage } from '../../schemas'

const llm = defaultModel

const MAX_EMAIL_LENGTH = 500
const MAX_ATTACHMENT_LENGTH = 1000
const MAX_CONTEXT_LENGTH = 20000

// "You are a personal assistant with the ability to search the following categories; emails, chat_history and documents. You receive a prompt and generate a JSON response (with no other text) that provides search queries that will source useful information to help answer the prompt. Search queries for each category should contain three properties; \"terms\" (an array of 10 individual words), \"beforeDate\" (results must be before this date), \"afterDate\" (results must be after this date), \"resultType\" (either \"count\" to count results or \"results\" to return the search results), \"filter\" (an array of key, value pairs of fields to filter the results). Categories can be empty if not relevant to the prompt. The current date is 2024-08-12.\n\nHere is an example JSON response:\n{\"email\": {\"terms\": [\"golf\", \"tennis\", \"soccer\"], \"beforeDate\": \"2024-06-01\", \"afterDate\": \"2024-01-10\" \"filter\": {\"from\": \"dave\"}, \"resultType\": \"results}}\n\nHere is the prompt:\nWhat subscriptions do I currently pay for?"

export class PromptSearchService extends VeridaService {

    public async prompt(prompt: string): Promise<{
        result: string,
        duration: number,
        promptSearchResult: PromptSearchLLMResponse
    }> {
        const start = Date.now()
        // // Get queries that can help answer the prompt
        // //const queryPrompt = `Generate 10 lucene search queries, include reasonable synonyms, to find relevant emails to help respond to this prompt:\n${prompt}\nYou have the following searchable fields: subject,messageText,fromName,fromEmail.\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
        // const keywordPrompt = `Generate 10 individual words that could help search for relevant emails realated to this prompt:\n${prompt}\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
        // const keywordResponse = await llm(keywordPrompt)
        // const entityPrompt = `Extract any individual or organization names mentioned in this prompt:\n${prompt}\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
        // const entityResponse = await llm(entityPrompt)

        // console.log(keywordResponse)
        // console.log(entityResponse)
        // const keywords = JSON.parse(keywordResponse)
        // let entities = []
        // try {
        //     entities = JSON.parse(entityResponse)
        // } catch (err) {
        //     // do nothing
        // }

        // console.log(keywords)
        // console.log(entities)
        const promptSearch = new PromptSearch(llm)
        const promptSearchResult = await promptSearch.search(prompt)

        let chatThreads: ChatThreadResult[] = []
        let emails: SchemaEmail[] = []

        const searchService = new SearchService(this.did, this.context)

        let maxAgeSeconds = undefined
        const dayInSeconds = 60*60*24
        switch (promptSearchResult.timeframe) {
            case "day":
                maxAgeSeconds = dayInSeconds
                break
            case "week":
                maxAgeSeconds = dayInSeconds*7
                break
            case "month":
                maxAgeSeconds = dayInSeconds*30
                break
            case "quarter":
                maxAgeSeconds = dayInSeconds*90
                break
            case "half-year":
                maxAgeSeconds = dayInSeconds*180
                break
            case "full-year":
                maxAgeSeconds = dayInSeconds*365
                break
        }
        const maxDatetime = new Date((new Date()).getTime() - maxAgeSeconds * 1000);
        const sortType = promptSearchResult.sort == "keyword_rank" ? SearchSortType.RECENT : <SearchSortType> promptSearchResult.sort

        emails = await searchService.emailsByKeywords(promptSearchResult.keywords, 20)
        chatThreads = await searchService.chatThreadsByKeywords(promptSearchResult.keywords, 10, 10)

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

        for (const email of emails) {
            let extraContext = ""
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

        const now = (new Date()).toISOString()
        finalPrompt += `${contextString}\nThe current time is: ${now}`

        console.log('Running final prompt', finalPrompt.length)
        const finalResponse = await llm.prompt(finalPrompt, undefined, false)
        const duration = Date.now() - start

        console.log(contextString)

        return {
            result: finalResponse.choices[0].message.content,
            duration,
            promptSearchResult
        }
    }

}