import { Request, Response } from "express";
import { Utils } from "../../../../utils";

/**
 *
 */
export class DsController {

    public async getById(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
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

    public async create(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
            const permissions = Utils.buildPermissions(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])

            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })

            const record = req.body.record
            const options = req.body.options || {}
            record.schema = schemaName
            const result = await ds.save(record, options)

            if (result) {
                record._id = (<any> result).id
                record._rev = (<any> result).rev
                res.json({
                    success: true,
                    record,
                    result
                })
            } else {
                res.json({
                    success: false,
                    errors: ds.errors
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
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
            const permissions = Utils.buildPermissions(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])
            const rowId = req.params[1]

            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })

            const record = req.body.record
            record._id = rowId
            record.schema = schemaName
            const options = req.body.options || {}
            const result = await ds.save(record, options)

            if (result) {
                res.json({
                    success: true,
                    record,
                    result
                })
            } else {
                res.json({
                    success: false,
                    errors: ds.errors
                })
            }
        } catch (error) {
            const message = error.message

            res.status(500).send({
                error: message
            });
        }
    }

    public async query(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
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
            let message = error.message
            if (error.message.match('invalid encoding')) {
                message = 'Invalid encoding (check permissions header)'
            }

            res.status(500).send({
                error: message
            });
        }
    }

    public async watch(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
            const permissions = Utils.buildPermissions(req)
            const schemaName = Utils.getSchemaFromParams(req.params[0])
            const options = req.body.options || {}

            const ds = await context.openDatastore(schemaName, {
                // @ts-ignore
                permissions
            })

            // Don't include docs as there's a bug that sends `undefined` doc values which crashes the encryption library
            options.include_docs = false
            // Live stream changes
            options.live = true
            // Only include new changes from now
            options.since = 'now'

            const db = await ds.getDb()
            const pouchDb = await db.getDb()

            // Set-up event source response
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders()
            // Tell the client to retry every 10 seconds if connectivity is lost
            res.write('retry: 10000\n\n')

            // Listen and handle changes
            pouchDb.changes(options)
                .on('change', async (change: any) => {
                    const record = await db.get(change.id)

                    res.write(`data: ${JSON.stringify({
                        type: 'record',
                        value: record
                    })}\n\n`)
                })
                .on('complete', (info: any) => {
                    res.write(`data: ${JSON.stringify({
                        type: 'complete'
                    })}\n\n`)

                    res.end()
                })
                .on('error', (error: any) => {
                    console.log('error!')
                    console.error(error)
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        value: error.message
                    })}\n\n`)

                    res.end()
                })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    public async delete(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
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
