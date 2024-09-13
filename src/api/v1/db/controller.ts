import { Request, Response } from "express";
import { Utils } from "../../../utils";

/**
 * 
 */
export class DbController {

    public async getById(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkFromRequest(req)
            const dbName = req.params[0]
            const rowId = req.params[1]
            const permissions = Utils.buildPermissions(req)

            const db = await context.openDatabase(dbName, {
                // @ts-ignore
                permissions
            })
            const item = await db.get(rowId)
            res.json({
                item
            })
        } catch (error) {
            if (error.message.match("missing")) {
                res.status(404).send({
                    "error": "Not found"
                })
            } else {
                let message = error.message
                if (error.message.match('invalid encoding')) {
                    message = 'Invalid encoding (check permissions header)'
                }
                
                res.status(500).send({
                    "error": message
                });
            }
        }
    }

    public async query(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkFromRequest(req)
            const dbName = req.params[0]

            const permissions = Utils.buildPermissions(req)
            const db = await context.openDatabase(dbName, {
                // @ts-ignore
                permissions
            })

            const filter = req.body.query || {}
            const options = req.body.options || {}
            const items = await db.getMany(filter, options)

            res.json({
                items,
                limit: options.limit ? options.limit : 20,
                skip: options.skip ? options.skip : 0
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }
}

export const controller = new DbController()