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

            const threadSize = 10
            const limit = 10
            const mergeOverlaps = true

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
            const keywordString = req.body.keywords ? req.body.keywords.toString() : ""
            const keywords = keywordString.split(' ')

            const options = req.body.options || {}
            const searchTypes = req.body.searchTypes ? req.body.searchTypes.split(',') : [
                SearchType.EMAILS,
                SearchType.CHAT_MESSAGES
            ]
            const limit = req.body.limit ? req.body.limit : 20
            const minResultsPerType = req.body.minResultsPerType ? req.body.minResultsPerType : 5

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