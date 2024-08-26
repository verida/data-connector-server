const _ = require('lodash')
import { defaultModel } from "../llm"
import { PromptSearch, PromptSearchLLMResponse, PromptSearchSort } from "../tools/promptSearch"
import { ChatThreadResult, SearchService, SearchSortType, SearchType } from "../search"
import { VeridaService } from '../veridaService'
import { SchemaEmail, SchemaSocialChatMessage } from '../../schemas'
import { Helpers } from "../helpers"

const llm = defaultModel

const MAX_EMAIL_LENGTH = 500
const MAX_ATTACHMENT_LENGTH = 1000
const MAX_CONTEXT_LENGTH = 20000 // (~5000 tokens)

const MAX_DATERANGE_EMAILS = 40
const MAX_DATERANGE_CHAT_MESSAGES = 100

// "You are a personal assistant with the ability to search the following categories; emails, chat_history and documents. You receive a prompt and generate a JSON response (with no other text) that provides search queries that will source useful information to help answer the prompt. Search queries for each category should contain three properties; \"terms\" (an array of 10 individual words), \"beforeDate\" (results must be before this date), \"afterDate\" (results must be after this date), \"resultType\" (either \"count\" to count results or \"results\" to return the search results), \"filter\" (an array of key, value pairs of fields to filter the results). Categories can be empty if not relevant to the prompt. The current date is 2024-08-12.\n\nHere is an example JSON response:\n{\"email\": {\"terms\": [\"golf\", \"tennis\", \"soccer\"], \"beforeDate\": \"2024-06-01\", \"afterDate\": \"2024-01-10\" \"filter\": {\"from\": \"dave\"}, \"resultType\": \"results}}\n\nHere is the prompt:\nWhat subscriptions do I currently pay for?"

export class PromptSearchService extends VeridaService {

    public async prompt(prompt: string): Promise<{
        result: string,
        duration: number,
        process: PromptSearchLLMResponse
    }> {
        const start = Date.now()
        const promptSearch = new PromptSearch(llm)
        const promptSearchResult = await promptSearch.search(prompt)

        console.log(promptSearchResult)

        let chatThreads: ChatThreadResult[] = []
        let emails: SchemaEmail[] = []
        let chatMessages: SchemaSocialChatMessage[] = []

        const searchService = new SearchService(this.did, this.context)

        if (promptSearchResult.sort == PromptSearchSort.KEYWORD_RANK) {
            emails = await searchService.emailsByKeywords(promptSearchResult.keywords, promptSearchResult.timeframe, 20)
            chatThreads = await searchService.chatThreadsByKeywords(promptSearchResult.keywords, promptSearchResult.timeframe, 10, 10)
        } else {
            const maxDatetime = Helpers.keywordTimeframeToDate(promptSearchResult.timeframe)
            const sort = promptSearchResult.sort == PromptSearchSort.RECENT ? SearchSortType.RECENT : SearchSortType.OLDEST
            emails = <SchemaEmail[]> await searchService.schemaByDateRange(SearchType.EMAILS, maxDatetime, sort, MAX_DATERANGE_EMAILS)
            chatMessages = <SchemaSocialChatMessage[]> await searchService.schemaByDateRange(SearchType.CHAT_MESSAGES, maxDatetime, sort, MAX_DATERANGE_CHAT_MESSAGES)
        }

        let finalPrompt = `Answer this prompt:\n${prompt}\nHere are some recent messages that may help you provide a relevant answer.\n`
        let contextString = ''

        let maxChatMessages = MAX_DATERANGE_CHAT_MESSAGES
        for (const chatThread of chatThreads) {
            for (const chatMessage of chatThread.messages) {
                contextString += `From: ${chatMessage.fromName} <${chatMessage.fromHandle}> (${chatMessage.groupName})\nBody: ${chatMessage.messageText}\n\n`

                if (maxChatMessages-- <= 0) {
                    break
                }
            }
        }

        for (const chatMessage of chatMessages) {
            contextString += `From: ${chatMessage.fromName} <${chatMessage.fromHandle}> (${chatMessage.groupName})\nBody: ${chatMessage.messageText}\n\n`
        }

        // console.log('pre-email context string: ', contextString.length)

        let emailCount = 0
        for (const email of emails) {
            let extraContext = ""
            let body = email.messageText.substring(0, MAX_EMAIL_LENGTH)
            if (email.attachments) {
                for (const attachment of email.attachments) {
                    body += attachment.textContent.substring(0, MAX_ATTACHMENT_LENGTH)
                }
            }

            extraContext = `From: ${email.fromName} <${email.fromEmail}> (${email.name})\nBody: ${body}\n\n`
            // console.log(email.fromName, email.fromEmail, email.name, body.length, email.messageText.length)
            if ((extraContext.length + contextString.length + finalPrompt.length) > MAX_CONTEXT_LENGTH) {
                break
            }
            
            contextString += extraContext
            emailCount++
        }

        // console.log('email count', emailCount)

        const now = (new Date()).toISOString()
        finalPrompt += `${contextString}\nThe current time is: ${now}`

        // console.log('Running final prompt', finalPrompt.length)
        const finalResponse = await llm.prompt(finalPrompt, undefined, false)
        const duration = Date.now() - start

        // console.log(contextString)

        return {
            result: finalResponse.choices[0].message.content,
            duration,
            process: promptSearchResult
        }
    }

}