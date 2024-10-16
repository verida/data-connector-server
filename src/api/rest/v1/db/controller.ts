import { Request, Response } from "express";
import { Utils } from "../../../../utils";

/**
 *
 */
export class DbController {

    public async getById(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
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
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
            const dbName = req.params[0]

            const permissions = Utils.buildPermissions(req)
            const db = await context.openDatabase(dbName, {
                // @ts-ignore
                permissions
            })

            const filter = req.body.query || {}
            const options = req.body.options || {}
            const items = await db.getMany(filter, options)
            const pouchDb = await db.getDb()
            const info = await pouchDb.info()

            // Build total number of rows, excluding special CouchDB index rows
            // Note: total_rows includes the special _id index which isn't included in rows, hence the + 1
            const indexInfo = await pouchDb.getIndexes()
            const dbRows = info.doc_count - indexInfo.total_rows + 1

            res.json({
                items,
                limit: options.limit ? options.limit : 20,
                skip: options.skip ? options.skip : 0,
                dbRows
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }
}

export const controller = new DbController()
