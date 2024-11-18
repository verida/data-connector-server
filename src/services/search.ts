import { DataService } from "./data"
import { VeridaService } from "./veridaService"
import { SchemaRecord, SchemaSocialChatGroup, SchemaSocialChatMessage } from "../schemas"
import { IDatastore } from "@verida/types"
import { KeywordSearchTimeframe } from "../helpers/interfaces"
import { Helpers } from "./helpers"
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
    FILES = "files",
    CHAT_MESSAGES = "messages",
    EMAILS = "emails",
    FAVORITES = "favorites",
    FOLLOWING = "followed_pages",
    POSTS = "posts",
    CALENDAR_EVENT = "calendar"
}

export const SearchTypeSchemas: Record<SearchType, string> = {
    // [SearchType.CHAT_THREADS]: "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json",
    [SearchType.FILES]: "https://common.schemas.verida.io/file/v0.1.0/schema.json",
    [SearchType.CHAT_MESSAGES]: "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json",
    [SearchType.EMAILS]: "https://common.schemas.verida.io/social/email/v0.1.0/schema.json",
    [SearchType.FAVORITES]: "https://common.schemas.verida.io/favourite/v0.1.0/schema.json",
    [SearchType.POSTS]: "https://common.schemas.verida.io/social/post/v0.1.0/schema.json",
    [SearchType.FOLLOWING]: "https://common.schemas.verida.io/social/following/v0.1.0/schema.json",
    [SearchType.CALENDAR_EVENT]: "https://common.schemas.verida.io/social/event/v0.1.0/schema.json",
}

export const SearchTypeTimeProperty: Record<SearchType, string> = {
    // [SearchType.CHAT_THREADS]: "sentAt",
    [SearchType.FILES]: "insertedAt",
    [SearchType.CHAT_MESSAGES]: "sentAt",
    [SearchType.EMAILS]: "sentAt",
    [SearchType.FAVORITES]: "insertedAt",
    [SearchType.POSTS]: "insertedAt",
    [SearchType.FOLLOWING]: "followedTimestamp",
    [SearchType.CALENDAR_EVENT]: "start.dateTime",
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

        // console.log('returning ', results.length, 'items')
        return results
    }

    public async schemaByKeywords<T extends SchemaRecord>(searchType: SearchType, keywordsList: string[], timeframe: KeywordSearchTimeframe, limit: number = 20): Promise<T[]> {
        const query = keywordsList.join(' ')
        const schemaUri = SearchTypeSchemas[searchType]
        const dataService = new DataService(this.did, this.context)

        const maxDatetime = Helpers.keywordTimeframeToDate(timeframe)

        console.log(query, maxDatetime)
        
        const searchResults = await dataService.searchIndex(schemaUri, query, limit, undefined, {
            filter: (result: any) => maxDatetime ? result[SearchTypeTimeProperty[searchType]] > maxDatetime.toISOString() : true
        })

        return await this.rankAndMergeResults([{
            searchType,
            rows: searchResults
        }], limit) as T[]
    }

    public async schemaByDateRange<T extends SchemaRecord>(searchType: SearchType, maxDatetime: Date, sortType: SearchSortType, limit: number = 20): Promise<T[]> {
        const schemaUri = SearchTypeSchemas[searchType]
        const dataService = new DataService(this.did, this.context)
        const datastore = await dataService.getDatastore(schemaUri)

        const maxDate = new Date((new Date()).getTime() + (60*60*24*7) * 1000);

        const filter = {
            [SearchTypeTimeProperty[searchType]]: {
                "$gte": maxDatetime.toISOString(),
                // Don't load data more than a week into the future (to ignore calendar events well into the future)
                "$lte": maxDate.toISOString()
            }
        }
        const options = {
            limit,
            sort: [
                {
                    [SearchTypeTimeProperty[searchType]]: sortType == SearchSortType.OLDEST ? "asc" : "desc"
                }
            ]
        }

        return await datastore.getMany(filter, options) as T[]
    }

    public async chatHistoryByKeywords(keywordsList: string[], timeframe: KeywordSearchTimeframe, limit: number = 20): Promise<SchemaRecord[]> {
        const searchType = SearchType.CHAT_MESSAGES
        const schemaUri = SearchTypeSchemas[searchType]
        const query = keywordsList.join(' ')
        const dataService = new DataService(this.did, this.context)
        const miniSearchIndex = await dataService.getIndex(schemaUri)

        const maxDatetime = Helpers.keywordTimeframeToDate(timeframe)
        
        const searchResults = await miniSearchIndex.search(query, {
            filter: (result: any) => maxDatetime ? result[SearchTypeTimeProperty[searchType]] > maxDatetime.toISOString() : true
        })

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
    public async chatThreadsByKeywords(keywordsList: string[], timeframe: KeywordSearchTimeframe, threadSize: number = 10, limit: number = 20, mergeOverlaps: boolean = true): Promise<ChatThreadResult[]> {
        const query = keywordsList.join(' ')
        const messageSchemaUri = "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json"
        const groupSchemaUri = "https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json"
        const dataService = new DataService(this.did, this.context)

        const maxDatetime = Helpers.keywordTimeframeToDate(timeframe)
        
        const searchResults = await dataService.searchIndex(messageSchemaUri, query, 50, 0.5, {
            filter: (result: any) => maxDatetime ? result[SearchTypeTimeProperty[SearchType.CHAT_MESSAGES]] > maxDatetime.toISOString() : true
        })
        
        const chatMessageDs = await this.context.openDatastore(messageSchemaUri)
        const chatGroupDs = await this.context.openDatastore(groupSchemaUri)

        const groupCache: Record<string, SchemaSocialChatGroup> = {}
        async function getGroup(groupId: string) {
            if (groupCache[groupId]) {
                return groupCache[groupId]
            }

            groupCache[groupId] = await chatGroupDs.get(groupId, {})

            delete groupCache[groupId]['sourceData']
            return groupCache[groupId]
        }

        // Build a list of messages for each chat group
        const chatThreadMessageIds: Record<string, string[]> = {}
        // Build a chat group of results for each chat group
        const chatThreads: Record<string, ChatThreadResult> = {}
        for (const searchResult of searchResults) {
            if (!chatThreads[searchResult.groupId]) {
                chatThreads[searchResult.groupId] = {
                    group: await getGroup(searchResult.groupId),
                    messages: []
                }
            }

            if (!chatThreadMessageIds[searchResult.groupId]) {
                chatThreadMessageIds[searchResult.groupId] = []
            }

            chatThreadMessageIds[searchResult.groupId].push(searchResult.id)
        }

        async function fetchMessagesWithContext(db: any, groupId: string, messageIds: string[], windowSize = 10) {
            const results: SchemaSocialChatMessage[] = []
            const fetchedMessages = new Set<SchemaSocialChatMessage>(); // Track fetched messages
        
            // Sort the message IDs lexicographically
            const sortedMessageIds = messageIds.sort();
        
            // Determine the range for initial query
            const startKey = sortedMessageIds[0];
            const endKey = sortedMessageIds[sortedMessageIds.length - 1];
        
            let lastFetchedKey = startKey; // Track the last fetched message ID
        
            try {
            // Use a sliding window to fetch messages in chunks
            for (const messageId of sortedMessageIds) {
                if (lastFetchedKey > messageId) {
                    continue
                }

                const response = await db.find({
                    selector: {
                        groupId: groupId,
                        _id: { $gte: lastFetchedKey, $lte: endKey }
                    },
                    sort: [{ _id: 'asc' }],
                    limit: windowSize
                });
        
                // Break the loop if no more messages are found
                if (response.docs.length === 0) break;
        
                // Step 4: Process and collect fetched messages
                response.docs.forEach((doc: any) => {
                if (!fetchedMessages.has(doc._id)) {
                    results.push(doc);
                    fetchedMessages.add(doc._id); // Mark this message ID as fetched
                }
                });
        
                // Update the last fetched key to the next message ID for the sliding window
                lastFetchedKey = response.docs[response.docs.length - 1]._id;
        
                // Slide the window to the next set of messages
                if (lastFetchedKey === endKey) break; // Stop if the last fetched key reaches the end
            }
        
            } catch (err) {
                console.error(`Error fetching messages for group ${groupId}:`, err);
            }
        
            // console.log(`Finished processing group: ${groupId} (${fetchedMessages.values.length})`);

            return results
          }

        // Process each chat group
        const veridaDb = await chatMessageDs.getDb()
        const pouchDb = await veridaDb.getDb()

        for (const groupId in chatThreadMessageIds) {
            chatThreads[groupId].messages = await fetchMessagesWithContext(pouchDb, groupId, chatThreadMessageIds[groupId])
            break
        }

        const results = Object.values(chatThreads)
        return results
    }

    public async multiByKeywords(searchTypes: SearchType[], keywordsList: string[], timeframe: KeywordSearchTimeframe, limit: number = 20, minResultsPerType: number = 10) {
        const query = keywordsList.join(' ')
        const dataService = new DataService(this.did, this.context)

        const maxDatetime = Helpers.keywordTimeframeToDate(timeframe)

        const searchResults = []
        for (const searchType of searchTypes) {
            const schemaUri = SearchTypeSchemas[searchType]
            if (!schemaUri) {
                // Invalid search type, ignore
                continue
            }
            const miniSearchIndex = await dataService.getIndex(schemaUri)
            const queryResult = <MinisearchResult[]> await miniSearchIndex.search(query, {
                filter: (result: any) => {
                    return maxDatetime ? result[SearchTypeTimeProperty[searchType]] > maxDatetime.toISOString() : true
                }
            })

            searchResults.push({
                searchType,
                rows: queryResult
            })
        }

        return this.rankAndMergeResults(searchResults, limit, minResultsPerType)
    }

}