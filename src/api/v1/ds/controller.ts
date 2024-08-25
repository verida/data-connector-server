import { Request, Response } from "express";
import Common from "../common";
import { IContext, IDatabase, IDatastore } from "@verida/types";
import { Utils } from "../../../utils";

/**
 * 
 */
export class DsController {
    
    public async get(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkFromRequest(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])
            const permissions = Utils.buildPermissions(req)
        
            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })
            const items = await (await ds).getMany()
            res.json({
                items
            })
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
            const permissions = Utils.buildPermissions(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])
            const rowId = req.params[1]
            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })
        
            const item = await ds.get(rowId, {})
            res.json({
                item: item
            })
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    public async query(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkFromRequest(req)
            const permissions = Utils.buildPermissions(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])

            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })
        
            const selector = req.body.query
            const options = req.body.options || {}
            const items = await ds.getMany(selector, options)
            res.json({
                items
            })
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}

export const controller = new DsController()