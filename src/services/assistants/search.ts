const _ = require('lodash')
import { LLM } from "../llm"
import { PromptSearch, PromptSearchLLMResponse, PromptSearchSort, PromptSearchType } from "../tools/promptSearch"
import { ChatThreadResult, SearchService, SearchSortType, SearchType } from "../search"
import { VeridaService } from '../veridaService'
import { SchemaEmail, SchemaEvent, SchemaFavourite, SchemaFile, SchemaFollowing, SchemaSocialChatMessage } from '../../schemas'
import { Helpers } from "../helpers"
import { EmailShortlist } from "../tools/emailShortlist"
import { PromptSearchServiceConfig } from "./interfaces"

const DEFAULT_PROMPT_SEARCH_SERVICE_CONFIG: PromptSearchServiceConfig = {
    maxContextLength: 20000, // (~5000 tokens)
    dataTypes: {
        emails: {
            limit: 30,
            maxLength: 500,
            attachmentLength: 500
        },
        chatMessages: {
            limit: 100
        },
        favorites: {
            limit: 30
        },
        following: {
            limit: 30
        },
        files: {
            limit: 30,
            maxLength: 2000
        },
        calendarEvents: {
            limit: 30
        },
    }
}


function secondsSince(date: Date) {
    const now = new Date();
    const differenceInMilliseconds = now.getTime() - date.getTime();
    const differenceInSeconds = Math.floor(differenceInMilliseconds / 1000);
    return differenceInSeconds;
  }


export class PromptSearchService extends VeridaService {

    public async prompt(prompt: string, llm: LLM, config?: PromptSearchServiceConfig): Promise<{
        result: string,
        timers: Record<string, number>,
        duration: number,
        process: PromptSearchLLMResponse
    }> {
        const timers: Record<string, number> = {}
        let start = new Date()
        const startDate = new Date()

        config = _.merge({}, DEFAULT_PROMPT_SEARCH_SERVICE_CONFIG, config)

        let promptSearchResult
        if (config?.promptSearchConfig) {
            promptSearchResult = config.promptSearchConfig
        } else {
            const promptSearch = new PromptSearch(llm)
            promptSearchResult = await promptSearch.search(prompt)
        }

        timers['search-prompt'] = secondsSince(start)
        start = new Date()

        this.verifyPromptSearchResult(promptSearchResult)

        let chatThreads: ChatThreadResult[] = []
        let emails: SchemaEmail[] = []
        let favourites: SchemaFavourite[] = []
        let following: SchemaFollowing[] = []
        let files: SchemaFile[] = []
        let chatMessages: SchemaSocialChatMessage[] = []
        let calendarEvents: SchemaEvent[] = []

        const searchService = new SearchService(this.did, this.context)

        if (promptSearchResult.search_type == PromptSearchType.KEYWORDS) {
            console.log(`Searching by keywords: ${promptSearchResult.keywords!}`)
            if (promptSearchResult.databases.indexOf(SearchType.EMAILS) !== -1) {
                emails = await searchService.schemaByKeywords<SchemaEmail>(SearchType.EMAILS, promptSearchResult.keywords!, promptSearchResult.timeframe, 40)
            }
            if (promptSearchResult.databases.indexOf(SearchType.FILES) !== -1) {
                files = await searchService.schemaByKeywords<SchemaFile>(SearchType.FILES, promptSearchResult.keywords!, promptSearchResult.timeframe, 20)
            }
            if (promptSearchResult.databases.indexOf(SearchType.FAVORITES) !== -1) {
                favourites = await searchService.schemaByKeywords<SchemaFavourite>(SearchType.FAVORITES, promptSearchResult.keywords!, promptSearchResult.timeframe, 40)
            }
            if (promptSearchResult.databases.indexOf(SearchType.FOLLOWING) !== -1) {
                following = await searchService.schemaByKeywords<SchemaFollowing>(SearchType.FOLLOWING, promptSearchResult.keywords!, promptSearchResult.timeframe, 40)
            }
            if (promptSearchResult.databases.indexOf(SearchType.CHAT_MESSAGES) !== -1) {
                chatThreads = await searchService.chatThreadsByKeywords(promptSearchResult.keywords!, promptSearchResult.timeframe, 10, 20)
            }
            if (promptSearchResult.databases.indexOf(SearchType.CALENDAR_EVENT) !== -1) {
                calendarEvents = await searchService.schemaByKeywords<SchemaEvent>(SearchType.CALENDAR_EVENT, promptSearchResult.keywords!, promptSearchResult.timeframe, 40)
            }
        } else {
            const maxDatetime = Helpers.keywordTimeframeToDate(promptSearchResult.timeframe)
            const sort = promptSearchResult.sort == PromptSearchSort.RECENT ? SearchSortType.RECENT : SearchSortType.OLDEST
            console.log(`Searching by timeframe: ${maxDatetime} ${sort}`)
            if (promptSearchResult.databases.indexOf(SearchType.EMAILS) !== -1) {
                emails = await searchService.schemaByDateRange<SchemaEmail>(SearchType.EMAILS, maxDatetime, sort, config.dataTypes.emails.limit*3)
                if (emails.length > config.dataTypes.emails.limit) {
                    const emailShortlist = new EmailShortlist(llm)
                    emails = await emailShortlist.shortlist(prompt, emails, config.dataTypes.emails.limit)
                }
            }
            if (promptSearchResult.databases.indexOf(SearchType.FILES) !== -1) {
                files = await searchService.schemaByDateRange<SchemaFile>(SearchType.FILES, maxDatetime, sort, config.dataTypes.files.limit)
            }
            if (promptSearchResult.databases.indexOf(SearchType.FAVORITES) !== -1) {
                favourites = await searchService.schemaByDateRange<SchemaFavourite>(SearchType.FAVORITES, maxDatetime, sort, config.dataTypes.favorites.limit)
            }
            if (promptSearchResult.databases.indexOf(SearchType.FOLLOWING) !== -1) {
                following = await searchService.schemaByDateRange<SchemaFollowing>(SearchType.FOLLOWING, maxDatetime, sort, config.dataTypes.following.limit)
            }
            if (promptSearchResult.databases.indexOf(SearchType.CHAT_MESSAGES) !== -1) {
                chatMessages = <SchemaSocialChatMessage[]> await searchService.schemaByDateRange(SearchType.CHAT_MESSAGES, maxDatetime, sort, config.dataTypes.chatMessages.limit)
            }
            if (promptSearchResult.databases.indexOf(SearchType.CALENDAR_EVENT) !== -1) {
                calendarEvents = await searchService.schemaByDateRange<SchemaEvent>(SearchType.CALENDAR_EVENT, maxDatetime, sort, config.dataTypes.calendarEvents.limit)
            }
        }

        timers['search-complete'] = secondsSince(start)
        start = new Date()

        promptSearchResult.search_summary = `Files: ${files.length}, Emails: ${emails.length}, Favorites: ${favourites.length}, Following: ${following.length}, ChatThreads: ${chatThreads.length}, CalendarEvents: ${calendarEvents.length}`
        console.log(promptSearchResult.search_summary)

        let finalPrompt = `${prompt}\n\nHere is some of my personal data that may help you provide a relevant answer.\n`
        let contextString = ''

        let maxChatMessages = config.dataTypes.chatMessages.limit
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

        for (const file of files) {
            contextString += `File: ${file.name} ${file.contentText.substring(0,config.dataTypes.files.maxLength)} (via ${file.sourceApplication})\n\n`
        }

        for (const favourite of favourites) {
            contextString += `Favorite: ${favourite.name} ${favourite.description?.substring(0,100)} (via ${favourite.sourceApplication})\n\n`
        }

        for (const follow of following) {
            contextString += `Following: ${follow.name} ${follow.description?.substring(0,100)} (via ${follow.sourceApplication})\n\n`
        }

        for (const event of calendarEvents) {
            const attendees = event.attendees ? event.attendees.map((attendee) => { `${attendee.displayName || ''} <${attendee.email}>` }).join(', ') : ''
            const description = event.description ? `Description: ${event.description?.substring(0,100)} ${attendees}\n` : ''
            contextString += `Calendar Event: ${event.name} from ${event.start.dateTime} to ${event.end.dateTime} (via ${event.sourceApplication}).\n${attendees ? attendees + "\n" : ""}${description}Creator: ${event.creator.displayName || ''} <${event.creator.email}>\nLink: ${event.uri}\n\n`
        }

        let emailCount = 0
        for (const email of emails) {
            let extraContext = ""
            let body = email.messageText.substring(0, config.dataTypes.emails.maxLength)
            if (email.attachments) {
                for (const attachment of email.attachments) {
                    body += attachment.textContent!.substring(0, config.dataTypes.emails.attachmentLength)
                }
            }

            extraContext = `To: ${email.toName} <${email.toEmail}>\nFrom: ${email.fromName} <${email.fromEmail}> (${email.name})\nBody: ${body}\n\n`
            if ((extraContext.length + contextString.length + finalPrompt.length) > config.maxContextLength) {
                break
            }
            
            contextString += extraContext
            emailCount++
        }

        const now = (new Date()).toISOString()
        finalPrompt += `${contextString}\nThe current time is: ${now}`

        const finalResponse = await llm.prompt(finalPrompt, undefined, config.jsonFormat)
        timers['prompt-complete'] = secondsSince(start)
        start = new Date()
        const duration = ((Date.now() - startDate.getTime()) / 1000.0)

        // console.log(contextString)

        return {
            result: finalResponse.choices[0].message.content!,
            timers,
            duration,
            process: promptSearchResult
        }
    }

    protected verifyPromptSearchResult(promptSearchResult: PromptSearchLLMResponse) {
        // Perform some basic checks, but should use something like zod to verify properly
        if (!promptSearchResult || !promptSearchResult.databases || !promptSearchResult.timeframe || !promptSearchResult.sort || !promptSearchResult.output_type) {
            throw new Error(`Invalid prompt search config`)
        }
    }

}