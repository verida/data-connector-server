import { Request, Response } from "express";
import { Utils } from "../../../utils";
import { SearchService } from "../../../services/search"


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
            const results = await searchService.chatThreads(keywords, threadSize, limit, mergeOverlaps)

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