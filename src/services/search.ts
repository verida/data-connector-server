import { DataService } from "./data"
import { VeridaService } from "./veridaService"
import { SchemaEmail, SchemaRecord, SchemaSocialChatGroup, SchemaSocialChatMessage } from "../schemas"
import { IDatastore } from "@verida/types"
import { threadId } from "worker_threads"
const _ = require('lodash')

export interface MinisearchResult {
    id: string
    schemaUrl?: string
    score: number
    terms: string[]
    queryTerms: string[]
    match: Record<string, string[]>
}

export interface SearchServiceSchemaResult {
    searchType: SearchType
    rows: MinisearchResult[]
}


export enum SearchSortType {
    RECENT = "recent",
    OLDEST = "oldest"
}

export enum SearchType {
    // CHAT_THREADS = "chat-threads",
    CHAT_MESSAGES = "chat-messages",
    EMAILS = "emails",
    FAVORITES = "favorites",
    FOLLOWING = "following",
    POSTS = "posts"
}

export const SearchTypeSchemas: Record<SearchType, string> = {
    // [SearchType.CHAT_THREADS]: "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json",
    [SearchType.CHAT_MESSAGES]: "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json",
    [SearchType.EMAILS]: "https://common.schemas.verida.io/social/email/v0.1.0/schema.json",
    [SearchType.FAVORITES]: "https://common.schemas.verida.io/favourite/v0.1.0/schema.json",
    [SearchType.POSTS]: "https://common.schemas.verida.io/social/post/v0.1.0/schema.json",
    [SearchType.FOLLOWING]: "https://common.schemas.verida.io/favourite/v0.1.0/schema.json",
}

export interface ChatThreadResult {
    group: SchemaSocialChatGroup,
    messages: SchemaSocialChatMessage[]
}

export class SearchService extends VeridaService {

    protected async rankAndMergeResults(schemaResults: SearchServiceSchemaResult[], limit: number, minResultsPerType: number = 10): Promise<SchemaRecord[]> {
        const unsortedResults: Record<string, MinisearchResult> = {}
        const guaranteedResults: Record<string, MinisearchResult> = {}

        const datastores: Record<string, IDatastore> = {}
        for (const schemaResult of schemaResults) {
            let schemaResultCount = 0
            for (const row of schemaResult.rows) {
                // console.log(row.id, row.score)
                const result = {
                    ...row,
                    schemaUrl: SearchTypeSchemas[schemaResult.searchType]
                }

                if (schemaResultCount++ < minResultsPerType) {
                    guaranteedResults[row.id] = result
                } else {
                    unsortedResults[row.id] = result
                }
            }

            const schemaUri = SearchTypeSchemas[schemaResult.searchType]
            datastores[schemaUri] = await this.context.openDatastore(schemaUri)
        }

        const unsortedResultCount = Object.values(unsortedResults).length
        console.log(`Have ${unsortedResultCount} unsorted schema results`)
        if (unsortedResultCount == 0) {
            return []
        }

        // Sort results by score
        const sortedResults = Object.values(unsortedResults)
        sortedResults.sort((a: any, b: any) => b.score - a.score)

        const queuedResults = Object.values(guaranteedResults).concat(sortedResults)

        // Fetch actual results and limit them
        const results = []
        for (let i = 0; i < limit; i++) {
            const result = queuedResults[i]
            if (!result) {
                continue
            }

            const datastore = datastores[result.schemaUrl]
            const row = await datastore.get(result.id, {})
            delete result['schemaUrl']
            results.push({
                ...row,
                _match: result
            })
        }

        return results
    }

    public async emailsByKeywords(keywordsList: string[], limit: number = 20): Promise<SchemaEmail[]> {
        const query = keywordsList.join(' ')
        const searchType = SearchType.EMAILS
        const schemaUri = SearchTypeSchemas[searchType]
        const dataService = new DataService(this.did, this.context)
        const miniSearchIndex = await dataService.getIndex(schemaUri)

        console.log('Emails: searching for', query)
        
        const searchResults = await miniSearchIndex.search(query)
        return <SchemaEmail[]> await this.rankAndMergeResults([{
            searchType,
            rows: searchResults
        }], limit)
    }

    public async emailsByDateRange(maxDatetime: Date, sortType: SearchSortType, limit: number = 20): Promise<SchemaEmail[]> {
        const searchType = SearchType.EMAILS
        const schemaUri = SearchTypeSchemas[searchType]
        const dataService = new DataService(this.did, this.context)
        const emailDatastore = await dataService.getDatastore(schemaUri)
        const filter = {
            sentAt: {
                "$gte": maxDatetime.toISOString()
            }
        }
        const options = {
            limit,
            sort: [
                {
                    sentAt: sortType == SearchSortType.OLDEST ? "asc" : "desc"
                }
            ]
        }

        console.log('Emails: searching for', filter, options)
        return <SchemaEmail[]> await emailDatastore.getMany(filter, options)
    }

    public async chatHistoryByKeywords(keywordsList: string[], limit: number = 20): Promise<any[]> {
        const searchType = SearchType.CHAT_MESSAGES
        const schemaUri = SearchTypeSchemas[searchType]
        const query = keywordsList.join(' ')
        const dataService = new DataService(this.did, this.context)
        const miniSearchIndex = await dataService.getIndex(schemaUri)

        console.log('Chat history: searching for', query)
        
        const searchResults = await miniSearchIndex.search(query)
        return this.rankAndMergeResults([{
            searchType,
            rows: searchResults
        }], limit)
    }

    /**
     * Use search to find a collection of chat threads that are relevant for the query.
     * 
     * A chat thread is a sub-section of chat messages within a chat group.
     * 
     * @param keywordsList Keywords to search for
     * @param threadSize Maximum number of messages in each thread
     * @param limit Maximum number of threads to return
     * @param mergeOverlaps If there is an overlap of messages within the same chat group, they will be merged into a single thread.
     * @returns 
     */
    public async chatThreadsByKeywords(keywordsList: string[], threadSize: number = 10, limit: number = 20, mergeOverlaps: boolean = true): Promise<ChatThreadResult[]> {
        const query = keywordsList.join(' ')
        const messageSchemaUri = "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json"
        const groupSchemaUri = "https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json"
        const dataService = new DataService(this.did, this.context)
        const miniSearchIndex = await dataService.getIndex(messageSchemaUri)

        console.log('Chat threads: searching for', query)
        
        const searchResults = await miniSearchIndex.search(query)
        const chatMessageDs = await this.context.openDatastore(messageSchemaUri)
        const chatGroupDs = await this.context.openDatastore(groupSchemaUri)

        // Create a thread for each message
        async function buildThread(messageId: string, groupId: string): Promise<SchemaSocialChatMessage[]> {
            const maxMessages = Math.round(threadSize / 2)
            const startMessages = <SchemaSocialChatMessage[]> await chatMessageDs.getMany({
                _id: {
                    "$lte": messageId
                },
                groupId
            }, {
                limit: maxMessages,
                sort: [{_id: "desc"}]
            })
            const lastMessages = <SchemaSocialChatMessage[]> await chatMessageDs.getMany({
                _id: {
                    "$gt": messageId
                },
                groupId
            }, {
                limit: maxMessages,
                sort: [{_id: "asc"}]
            })

            const messages: SchemaSocialChatMessage[] = []
            for (const message of startMessages.concat(lastMessages)) {
                delete message['sourceData']
                messages.push(<SchemaSocialChatMessage> message)
            }

            // @todo: if not enough messages, fetch more to match threadSize

            return messages
        }

        const groupCache: Record<string, SchemaSocialChatGroup> = {}
        async function getGroup(groupId: string) {
            if (groupCache[groupId]) {
                return groupCache[groupId]
            }

            groupCache[groupId] = await chatGroupDs.get(groupId, {})

            delete groupCache[groupId]['sourceData']
            return groupCache[groupId]
        }

        const chatThreads: Record<string, ChatThreadResult> = {}
        let foundThreads = 0
        for (const searchResult of searchResults) {
            const messages = await buildThread(searchResult.id, searchResult.groupId)

            if (!chatThreads[searchResult.groupId]) {
                chatThreads[searchResult.groupId] = {
                    group: await getGroup(messages[0].groupId),
                    messages: []
                }
            }

            chatThreads[searchResult.groupId].messages = chatThreads[searchResult.groupId].messages.concat(messages)

            if (foundThreads++ >= limit) {
                break
            }
        }

        const results: ChatThreadResult[] = []
        for (const chatThread of Object.values(chatThreads)) {
            // Remove duplicate messages
            chatThread.messages = _.uniqBy(chatThread.messages, '_id')
            // Sort chat thread messages by _id
            chatThread.messages = _.sortBy(chatThread.messages, '_id')
            results.push(chatThread)
        }

        return results
        
    }

    public async multiByKeywords(searchTypes: SearchType[], keywordsList: string[], limit: number = 20, minResultsPerType: number = 10) {
        const query = keywordsList.join(' ')
        const dataService = new DataService(this.did, this.context)

        console.log('Multi: searching for', query)

        const searchResults = []
        for (const searchType of searchTypes) {
            const schemaUri = SearchTypeSchemas[searchType]
            if (!schemaUri) {
                // Invalid search type, ignore
                continue
            }
            const miniSearchIndex = await dataService.getIndex(schemaUri)
            const queryResult = <MinisearchResult[]> await miniSearchIndex.search(query)

            searchResults.push({
                searchType,
                rows: queryResult
            })
        }

        return this.rankAndMergeResults(searchResults, limit, minResultsPerType)
    }

}