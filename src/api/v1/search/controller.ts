import { Request, Response } from "express";
import { Utils } from "../../../utils";
import { SearchService, SearchType } from "../../../services/search"


class SearchController {

    public async chatThreads(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()
            const keywordString = req.query.keywords ? req.query.keywords.toString() : ""
            const keywords = keywordString.split(' ')

            const threadSize = req.query.threadSize ? parseInt(req.query.threadSize.toString()) : 10
            const limit = req.query.limit ? parseInt(req.query.limit.toString()) : 20
            const mergeOverlaps = req.query.limit ? req.query.merge.toString() == 'true' : true

            const searchService = new SearchService(did, context)
            const results = await searchService.chatThreadsByKeywords(keywords, threadSize, limit, mergeOverlaps)

            return res.json({
                keywords,
                results
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

            const searchTypes = req.query.searchTypes ? <SearchType[]> req.query.searchTypes.toString().split(',') : [
                SearchType.EMAILS,
                SearchType.CHAT_MESSAGES
            ]
            const limit = req.query.limit ? parseInt(req.query.limit.toString()) : 20
            const minResultsPerType = req.query.minResultsPerType ? parseInt(req.query.minResultsPerType.toString()) : 5

            const searchService = new SearchService(did, context)
            const results = await searchService.multiByKeywords(searchTypes, keywords, limit, minResultsPerType)

            return res.json({
                keywords,
                results
            })

        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }

    }

    public async email() {

    }

    public async chatHistory() {

    }

    public async hotLoad() {

    }

}

export const controller = new SearchController()