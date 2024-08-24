import { Request, Response } from "express";
import { DataService, HotLoadProgress } from '../../../services/data';
import { MinisearchService } from "../../../services/minisearch"

import { Utils } from '../../../utils';
const MAX_RESULTS = 20

/**
 * 
 */
export class DsController {

    public async searchDs(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()

            const schemaName = Utils.getSchemaFromParams(req.params[0])
            const query = req.query.keywords.toString()
            const searchOptions = req.query.options ? JSON.parse(req.query.options.toString()) : {}
            const indexFields = req.query.fields ? req.query.fields.toString().split(',') : []
            let storeFields = req.query.store ? req.query.store.toString().split(',') : []
            const permissions = Utils.buildPermissions(req)
            const limit = req.query.limit ? parseInt(req.query.limit.toString()) : MAX_RESULTS

            const result = await MinisearchService.searchDs(context, did, schemaName, query, searchOptions, indexFields, storeFields, limit, permissions)
            return res.json(result)
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    public async hotLoad(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()
            const data = new DataService(did, context)

            data.on('progress', (progress: HotLoadProgress) => {
                res.write(`data: ${JSON.stringify(progress)}\n\n`)
            })

            // Set-up event source response
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders()
            // Tell the client to retry every 10 seconds if connectivity is lost
            res.write('retry: 10000\n\n')

            await data.hotLoad()
            res.end()
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

}

export const controller = new DsController()