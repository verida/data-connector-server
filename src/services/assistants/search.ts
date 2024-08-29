const _ = require('lodash')
import { defaultModel } from "../llm"
import { PromptSearch, PromptSearchLLMResponse, PromptSearchSort, PromptSearchType } from "../tools/promptSearch"
import { ChatThreadResult, SearchService, SearchSortType, SearchType } from "../search"
import { VeridaService } from '../veridaService'
import { SchemaEmail, SchemaFavourite, SchemaFollowing, SchemaSocialChatMessage } from '../../schemas'
import { Helpers } from "../helpers"
import { EmailShortlist } from "../tools/emailShortlist"

const llm = defaultModel

const MAX_EMAIL_LENGTH = 500
const MAX_ATTACHMENT_LENGTH = 500
const MAX_CONTEXT_LENGTH = 20000 // (~5000 tokens)

const MAX_DATERANGE_EMAILS = 30
const MAX_DATERANGE_CHAT_MESSAGES = 100
const MAX_DATERANGE_FAVORITES = 30
const MAX_DATERANGE_FOLLOWING = 30
const MAX_DATERANGE_FILES = 20

// "You are a personal assistant with the ability to search the following categories; emails, chat_history and documents. You receive a prompt and generate a JSON response (with no other text) that provides search queries that will source useful information to help answer the prompt. Search queries for each category should contain three properties; \"terms\" (an array of 10 individual words), \"beforeDate\" (results must be before this date), \"afterDate\" (results must be after this date), \"resultType\" (either \"count\" to count results or \"results\" to return the search results), \"filter\" (an array of key, value pairs of fields to filter the results). Categories can be empty if not relevant to the prompt. The current date is 2024-08-12.\n\nHere is an example JSON response:\n{\"email\": {\"terms\": [\"golf\", \"tennis\", \"soccer\"], \"beforeDate\": \"2024-06-01\", \"afterDate\": \"2024-01-10\" \"filter\": {\"from\": \"dave\"}, \"resultType\": \"results}}\n\nHere is the prompt:\nWhat subscriptions do I currently pay for?"

export class PromptSearchService extends VeridaService {

    public async prompt(prompt: string): Promise<{
        result: string,
        duration: number,
        process: PromptSearchLLMResponse
    }> {
        console.time("PersonalPromptStart")
        const start = Date.now()
        const promptSearch = new PromptSearch(llm)
        console.time("KeywordPrompt")
        const promptSearchResult = await promptSearch.search(prompt)
        console.timeEnd("KeywordPrompt")

        console.log(promptSearchResult)

        let chatThreads: ChatThreadResult[] = []
        let emails: SchemaEmail[] = []
        let favourites: SchemaFavourite[] = []
        let following: SchemaFollowing[] = []
        // let files: SchemaFile[] = []
        let chatMessages: SchemaSocialChatMessage[] = []

        const searchService = new SearchService(this.did, this.context)

        console.time("DataFetch")
        if (promptSearchResult.search_type == PromptSearchType.KEYWORDS) {
            console.time("DataFetchKeywords")
            if (promptSearchResult.databases.indexOf(SearchType.EMAILS) !== -1) {
                emails = await searchService.schemaByKeywords<SchemaEmail>(SearchType.EMAILS, promptSearchResult.keywords!, promptSearchResult.timeframe, 40)
            }
            // if (promptSearchResult.databases.indexOf("files")) {
            //     files = await searchService.schemaByKeywords<SchemaFile>(SearchType.FILES, promptSearchResult.keywords!, promptSearchResult.timeframe, 20)
            // }
            if (promptSearchResult.databases.indexOf(SearchType.FAVORITES) !== -1) {
                favourites = await searchService.schemaByKeywords<SchemaFavourite>(SearchType.FAVORITES, promptSearchResult.keywords!, promptSearchResult.timeframe, 40)
            }
            if (promptSearchResult.databases.indexOf(SearchType.FOLLOWING) !== -1) {
                following = await searchService.schemaByKeywords<SchemaFollowing>(SearchType.FOLLOWING, promptSearchResult.keywords!, promptSearchResult.timeframe, 40)
            }
            if (promptSearchResult.databases.indexOf(SearchType.CHAT_MESSAGES) !== -1) {
                chatThreads = await searchService.chatThreadsByKeywords(promptSearchResult.keywords!, promptSearchResult.timeframe, 10, 20)
            }
            console.timeEnd("DataFetchKeywords")
        } else {
            console.time("DataFetchDaterange")
            const maxDatetime = Helpers.keywordTimeframeToDate(promptSearchResult.timeframe)
            const sort = promptSearchResult.sort == PromptSearchSort.RECENT ? SearchSortType.RECENT : SearchSortType.OLDEST
            if (promptSearchResult.databases.indexOf(SearchType.EMAILS) !== -1) {
                emails = await searchService.schemaByDateRange<SchemaEmail>(SearchType.EMAILS, maxDatetime, sort, MAX_DATERANGE_EMAILS*3)
                const emailShortlist = new EmailShortlist(llm)
                console.time("EmailShortlist")
                emails = await emailShortlist.shortlist(prompt, emails, MAX_DATERANGE_EMAILS)
                console.timeEnd("EmailShortlist")
            }
            // if (promptSearchResult.databases.indexOf("files")) {
            //     files = await searchService.schemaByDateRange<SchemaFile>(SearchType.FILES, maxDatetime, sort, MAX_DATERANGE_FILES)
            // }
            if (promptSearchResult.databases.indexOf(SearchType.FAVORITES) !== -1) {
                favourites = await searchService.schemaByDateRange<SchemaFavourite>(SearchType.FAVORITES, maxDatetime, sort, MAX_DATERANGE_FAVORITES)
            }
            if (promptSearchResult.databases.indexOf(SearchType.FOLLOWING) !== -1) {
                following = await searchService.schemaByDateRange<SchemaFollowing>(SearchType.FOLLOWING, maxDatetime, sort, MAX_DATERANGE_FOLLOWING)
            }
            if (promptSearchResult.databases.indexOf(SearchType.CHAT_MESSAGES) !== -1) {
                chatMessages = <SchemaSocialChatMessage[]> await searchService.schemaByDateRange(SearchType.CHAT_MESSAGES, maxDatetime, sort, MAX_DATERANGE_CHAT_MESSAGES)
            }
            console.timeEnd("DataFetchDaterange")
        }
        console.timeEnd("DataFetch")

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

        console.log('favourites: ', favourites.length)
        for (const favourite of favourites) {
            contextString += `Favorite: ${favourite.name} ${favourite.description?.substring(0,100)} (via ${favourite.sourceApplication})\n\n`
        }

        console.log('following: ', following.length)
        for (const follow of following) {
            contextString += `Following: ${follow.name} ${follow.description?.substring(0,100)} (via ${follow.sourceApplication})\n\n`
        }

        // console.log('pre-email context string: ', contextString.length)

        let emailCount = 0
        for (const email of emails) {
            let extraContext = ""
            let body = email.messageText.substring(0, MAX_EMAIL_LENGTH)
            if (email.attachments) {
                for (const attachment of email.attachments) {
                    body += attachment.textContent!.substring(0, MAX_ATTACHMENT_LENGTH)
                }
            }

            extraContext = `To: ${email.toName} <${email.toEmail}>\nFrom: ${email.fromName} <${email.fromEmail}> (${email.name})\nBody: ${body}\n\n`
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

        console.log('Running final prompt', finalPrompt.length)
        console.time("FinalPrompt")
        const finalResponse = await llm.prompt(finalPrompt, undefined, false)
        console.timeEnd("FinalPrompt")
        const duration = Date.now() - start

        // console.log(contextString)

        console.timeEnd("PersonalPromptStart")
        return {
            result: finalResponse.choices[0].message.content!,
            duration,
            process: promptSearchResult
        }
    }

}