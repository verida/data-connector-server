const _ = require('lodash')
import { Request, Response } from "express";
import { Utils } from "../../../../utils";

/**
 *
 */
export class DbController {

    public async getById(req: Request, res: Response) {
        try {
            const dbName = req.params[0]

            const { context } = await Utils.getNetworkConnectionFromRequest(req, {
                scopes: ["api:db-get-by-id", `db:${dbName}`]
            })
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

    public async create(req: Request, res: Response) {
        try {
            const dbName = req.params.database
            const { context } = await Utils.getNetworkConnectionFromRequest(req, {
                scopes: ["api:db-create", `db:${dbName}`]
            })

            const permissions = Utils.buildPermissions(req)
            const db = await context.openDatabase(dbName, {
                // @ts-ignore
                permissions
            })

            const record = req.body.record
            const options = req.body.options || {}
            const result = await db.save(record, options)

            if (result) {
                const savedRecord = await db.get((<any> result).id, {})
                record._rev = (<any> result).rev
                res.json({
                    success: true,
                    record: savedRecord
                })
            } else {
                res.json({
                    success: false,
                    // @ts-ignore
                    errors: db.errors
                })
            }
        } catch (error) {
            const message = error.message

            res.status(500).send({
                error: message
            });
        }
    }

    public async update(req: Request, res: Response) {
        try {
            const dbName = req.params.database
            const { context } = await Utils.getNetworkConnectionFromRequest(req, {
                scopes: ["api:db-update", `db:${dbName}`]
            })

            const permissions = Utils.buildPermissions(req)
            const db = await context.openDatabase(dbName, {
                // @ts-ignore
                permissions
            })
            const rowId = req.params.recordId

            const record = req.body.record
            record._id = rowId
            const options = req.body.options || {}
            const result = await db.save(record, options)

            // Ensure the record exists
            try {
                const existingRecord = await (db.get(rowId, {}))
            } catch (err: any) {
                // Record doesn't exist
                return res.status(404).json({
                    success: false,
                    message: "Not found"
                })
            }

            if (result) {
                const savedRecord = await db.get(record._id, {})
                res.json({
                    success: true,
                    record: savedRecord,
                    result
                })
            } else {
                res.json({
                    success: false,
                    // @ts-ignore
                    errors: db.errors
                })
            }
        } catch (error) {
            let message = error.message
            if (error.status == 409 && error.message == 'Document update conflict') {
                message = `Unable to update record: Not found`
            }

            res.status(500).send({
                error: message
            });
        }
    }

    public async query(req: Request, res: Response) {
        try {
            const dbName = req.params[0]
            const { context } = await Utils.getNetworkConnectionFromRequest(req, {
                scopes: ["api:db-query", `db:${dbName}`]
            })

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
