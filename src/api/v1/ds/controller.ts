import { Request, Response } from "express";
import { Utils } from "../../../utils";

/**
 * 
 */
export class DsController {

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
            const permissions = Utils.buildPermissions(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])

            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })
        
            const selector = req.body.query
            const options = req.body.options || {}
            const items = await ds.getMany(selector, options)
            const db = await ds.getDb()
            const pouchDb = await db.getDb()
            const info = await pouchDb.info()

            res.json({
                items,
                limit: options.limit ? options.limit : 20,
                skip: options.skip ? options.skip : 0,
                dbCount: info.doc_count
            })
        } catch (error) {
            let message = error.message
            if (error.message.match('invalid encoding')) {
                message = 'Invalid encoding (check permissions header)'
            }
            
            res.status(500).send({
                "error": message
            });
            
            res.status(500).send({
                error: message
            });
        }
    }

    public async delete(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkFromRequest(req)
            const permissions = Utils.buildPermissions(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])

            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })

            const deleteId = req.query.id ? req.query.id.toString() : undefined
            const destroy = req.query.destroy && req.query.destroy.toString() == "true"

            let action
            if (destroy) {
                action = "destroy"
                const db = await ds.getDb()
                await db.destroy()
            } else if (deleteId) {
                action = "delete"
                await ds.delete(deleteId)
            }

            return res.json({
                success: true,
                action
            })
        } catch (error) {
            res.status(500).send({
                error: error.message
            });
        }
    }
}

export const controller = new DsController()