import { Request, Response } from "express";
import { Utils } from "../../../utils";

/**
 * 
 */
export class DbController {
    
    public async get(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkFromRequest(req)
            const dbName = req.params[0]
            const permissions = Utils.buildPermissions(req)
        
            const db = await context.openDatabase(dbName, {
                // @ts-ignore
                permissions
            })
            const results = await (await db).getMany()
            res.json(results)
        } catch (error) {
            let message = error.message
            if (error.message.match('invalid encoding')) {
                message = 'Invalid encoding (check permissions header)'
            }

            res.status(500).send(message);
        }
    }

    public async getById(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkFromRequest(req)
            const dbName = req.params[0]
            const rowId = req.params[1]
            const permissions = Utils.buildPermissions(req)

            console.log(rowId)
            console.log(req)

            const db = await context.openDatabase(dbName, {
                // @ts-ignore
                permissions
            })
            const results = await (await db).get(rowId)
            res.json(results)
        } catch (error) {
            res.status(500).send(error.message);
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

            const selector = req.body.query
            const options = req.body.options || {}
            const results = await (await db).getMany(selector, options)
            res.json(results)
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}

export const controller = new DbController()