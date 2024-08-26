import { Request, Response } from "express";
import { Utils } from "../../../utils";
import { SearchService, SearchType } from "../../../services/search"
import { MinisearchService, SearchResultItem } from "../../../services/minisearch";
import { SchemaRecord } from "../../../schemas";
import { KeywordSearchTimeframe } from "../../../helpers/interfaces";

const DEFAULT_LIMIT = 20

export interface SchemaRecordSearchResult extends SchemaRecord {
    _match: SearchResultItem
}

export interface SearchResult {
    total: number
    items: SchemaRecordSearchResult
}

class SearchController {

    public async chatThreads(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()
            const keywordString = req.query.keywords ? req.query.keywords.toString() : ""
            const keywords = keywordString.split(' ')

            const threadSize = req.query.threadSize ? parseInt(req.query.threadSize.toString()) : 10
            const limit = req.query.limit ? parseInt(req.query.limit.toString()) : DEFAULT_LIMIT
            const mergeOverlaps = req.query.limit ? req.query.merge.toString() == 'true' : true
            const timeframe: KeywordSearchTimeframe = req.query.timeframe ? <KeywordSearchTimeframe> req.query.timeframe.toString() : undefined

            const searchService = new SearchService(did, context)
            const items = await searchService.chatThreadsByKeywords(keywords, timeframe, threadSize, limit, mergeOverlaps)

            return res.json({
                items
            })

        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    public async universal(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()
            const keywordString = req.query.keywords ? req.query.keywords.toString() : ""
            const keywords = keywordString.split(' ')
            const timeframe: KeywordSearchTimeframe = req.query.timeframe ? <KeywordSearchTimeframe> req.query.timeframe.toString() : undefined

            const searchTypes = req.query.searchTypes ? <SearchType[]> req.query.searchTypes.toString().split(',') : [
                SearchType.EMAILS,
                SearchType.CHAT_MESSAGES
            ]
            const limit = req.query.limit ? parseInt(req.query.limit.toString()) : DEFAULT_LIMIT
            const minResultsPerType = req.query.minResultsPerType ? parseInt(req.query.minResultsPerType.toString()) : 5

            const searchService = new SearchService(did, context)
            const items = await searchService.multiByKeywords(searchTypes, keywords, timeframe, limit, minResultsPerType)

            return res.json({
                items
            })

        } catch (error) {
            console.log(error)
            return res.status(500).send(error.message);
        }
    }

    public async ds(req: Request, res: Response) {
        return res.json({hello: 'world'})
    }

    public async datastore(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()

            const schemaName = Utils.getSchemaFromParams(req.params[0])
            const query = req.query.keywords.toString()
            const searchOptions = req.query.options ? JSON.parse(req.query.options.toString()) : {}
            const indexFields = req.query.fields ? req.query.fields.toString().split(',') : []
            let storeFields = req.query.store ? req.query.store.toString().split(',') : []
            const permissions = Utils.buildPermissions(req)
            const limit = req.query.limit ? parseInt(req.query.limit.toString()) : DEFAULT_LIMIT

            const searchResults = await MinisearchService.searchDs(context, did, schemaName, query, searchOptions, indexFields, storeFields, limit, permissions)
            const datastore = await context.openDatastore(schemaName)
            const items: SchemaRecordSearchResult[] = []
            for (const searchResult of searchResults.results) {
                const item = await datastore.get(searchResult.id, {})
                items.push({
                    ...item,
                    _match: searchResult
                })
            }

            return res.json({
                total: searchResults.count,
                items
            })
        } catch (error) {
            console.log(error)
            return res.status(500).send(error.message);
        }
    }
}

export const controller = new SearchController()