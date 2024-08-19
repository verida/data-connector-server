import Axios from 'axios'
import { stripHtml } from "string-strip-html"
const _ = require('lodash')
import { LLMServices } from "../services/llm"
import { SearchService } from "../services/search"
import { VeridaService } from './veridaService'

const llm = LLMServices.bedrock

const MAX_EMAIL_LENGTH = 500
const MAX_ATTACHMENT_LENGTH = 1000
const MAX_CONTEXT_LENGTH = 20000

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
        const emails = await searchService.emails(keywords.concat(entities))

        let finalPrompt = `Answer this prompt:\n${prompt}\nHere are some recent emails that may help you provide a relevant answer.\n`
        let contextString = ''
        for (const email of emails) {
            let body = stripHtml(email.messageText).result.substring(0, MAX_EMAIL_LENGTH)
            if (email.attachments) {
                for (const attachment of email.attachments) {
                    body += attachment.textContent.substring(0, MAX_ATTACHMENT_LENGTH)
                }
            }

            const extraContext = `${email.fromName} <${email.fromEmail}> (${email.name})\n${body}\n\n`
            if ((extraContext.length + contextString.length + finalPrompt.length) > MAX_CONTEXT_LENGTH) {
                break
            }
            
            contextString += extraContext
        }

        finalPrompt += contextString
        console.log('Running final prompt', finalPrompt.length)
        const finalResponse = await llm(finalPrompt)
        const duration = Date.now() - start

        return {
            result: finalResponse,
            duration,
            keywords,
            entities
        }
    }

}