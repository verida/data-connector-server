import { Request, Response } from 'express'
import Providers from "../../../../providers"
import SyncManager from '../../../../sync-manager'
import { ProviderHandler, SyncHandlerPosition, UniqueRequest } from '../../../../interfaces'
import { Utils } from '../../../../utils'
import CONFIG from '../../../../config'

const log4js = require("log4js")
const logger = log4js.getLogger()

const SCHEMA_SYNC_LOG = CONFIG.verida.schemas.SYNC_LOG

/**
 * Sign in process:
 * 
 * - Vault opens `connect` via safari
 * - User signs in
 * - Safari redirects to `callback`
 * - `callback` saves profile information in a datastore (DATA_PROFILE_SCHEMA) owned by this server, but readable by the user
 * - User is shown a deeplink which includes connection credentials (access, refresh token)
 * - User clicks deeplink to open Vault
 * - Vault fetches connection and profile information from the DATA_PROFILE_SCHEMA datastore
 * 
 * Data sync process:
 * 
 * - ..
 */
export default class Controller {

    /**
     * Initiate an auth connection for a given provider.
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    public static async connect(req: Request, res: Response, next: any) {
        logger.trace('connect()')
        const providerName = req.params.provider
        const query = req.query
        let redirect = query.redirect ? query.redirect.toString() : ''
        const key = query.key ? query.key.toString() : undefined
        const did = await Utils.getDidFromKey(key)

        if (!key) {
            return res.status(400).send({
                error: `Missing key in query parameters`
            });
        }

        // Session data isn't retained if using localhost, so use 127.0.0.1
        // @ts-ignore Session is injected as middleware
        req.session.redirect = redirect
        req.session.key = key
        req.session.did = did

        const provider = Providers(providerName)
        return provider.connect(req, res, next)
    }

    /**
     * Facilitate an auth callback for a given provider.
     * 
     * Requires `did` in the query string
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    public static async callback(req: UniqueRequest, res: Response, next: any) {
        logger.trace('callback()')
        const providerName = req.params.provider
        const provider = Providers(providerName)

        try {
            const connectionResponse = await provider.callback(req, res, next)
    
            const did = req.session.did
            const key = req.session.key
            const redirect = req.session.redirect

            const networkInstance = await Utils.getNetwork(key, req.requestId)

            const syncManager = new SyncManager(networkInstance.context, req.requestId)
            const connection = await syncManager.saveProvider(providerName, connectionResponse.accessToken, connectionResponse.refreshToken, connectionResponse.profile)

            if (redirect) {
                const redirectedUrl = new URL(redirect)
                redirectedUrl.searchParams.append("connectionId", connection._id)
                res.redirect(redirectedUrl.toString())
            } else {
                const output = `<html>
                    <head>
                        <style>
                        button {
                            font-size: 30pt;
                            margin-top: 50px;
                        }
                        </style>
                    </head>
                    <body>
                        <div style="margin: auto; text-align: center;">
                            <h2>Success!</h2>
                        </div>
                        <div style="margin: auto; text-align: center;">
                            <img src="/assets/${providerName}/icon.png" style="width: 200px; height: 200px;" />
                        </div>
                        <div style="margin: auto; text-align: center;">
                            <p>You may close this window</p>
                        </div>
                    </body>
                    </html>`
                
                Utils.closeConnection(did, req.requestId)
                
                res.send(output)
            }
            // } else {
                

            //     // let redirectPath = 'https://vault.verida.io/connection-success'
            //     // if (redirect != 'deeplink') {
            //     //     redirectPath = redirect
            //     // }

            //     // Send the access token, refresh token and profile database name and encryption key
            //     // so the user can pull their profile remotely and store their tokens securely
            //     // This also avoids this server saving those credentials anywhere, they are only stored by the user
            //     //const redirectUrl = `${redirectPath}?provider=${providerName}&accessToken=${connectionResponse.accessToken}&refreshToken=${connectionResponse.refreshToken ? connectionResponse.refreshToken : ''}`
                

            //     // @todo: Generate nice looking thank you page
            //     const output = `<html>
            //     <head>
            //         <style>
            //         button {
            //             font-size: 30pt;
            //             margin-top: 50px;
            //         }
            //         </style>
            //     </head>
            //     <body>
            //         <div style="margin: auto; text-align: center;">
            //             <img src="/assets/${providerName}/icon.png" style="width: 200px; height: 200px;" />
            //         </div>
            //         <div style="margin: auto; text-align: center;">
            //             <button onclick="window.location.href='${redirectUrl}'">Complete Connection</a>
            //         </div>
            //     </body>
            //     </html>`
                
            //     res.send(output)
            // }

            // dont sync for now
            //await syncManager.sync(providerName)
        } catch (err: any) {
            const message = err.message
            // @todo: Generate nice looking thank you page
            const output = `<html>
            <head></head>
            <body>
                <div style="margin: auto; text-align: center;">
                    <h1>Error</h1>
                    <p>${message}</p>
                </div>
            </body>
            </html>`
            
            res.send(output)
        }

        // @todo: close context. syncManager.close() or utils.closeContext()?
    }

    /**
     * Initialize a syncronization for a `Verida: Vault` context
     * 
     * @param req 
     * @param res 
     * @param next 
     */
    public static async sync(req: UniqueRequest, res: Response, next: any) {
        const query = req.query
        const providerName = query.provider ? query.provider.toString() : undefined
        const providerId = query.providerId ? query.providerId.toString() : undefined
        const forceSync = query.force ? query.force == 'true' : undefined

        const networkInstance = await Utils.getNetworkFromRequest(req)
        const syncManager = new SyncManager(networkInstance.context, req.requestId)
        const connections = await syncManager.sync(providerName, providerId, forceSync)

        // @todo: catch and send errors
        return res.send({
            connection: connections[0],
            success: true
        })
    }

    public static async providers(req: Request, res: Response) {
        const providers = Object.keys(CONFIG.providers)

        const results: any = []
        for (let p in providers) {
            const providerName = providers[p]

            try {
                const provider = Providers(providerName)
                const syncHandlers = await provider.getSyncHandlers()
                const handlers: ProviderHandler[] = []
                for (const handler of syncHandlers) {
                    handlers.push({
                        id: handler.getName(),
                        label: handler.getLabel(),
                        options: handler.getOptions()
                    })
                }

                results.push({
                    name: providerName,
                    label: provider.getProviderLabel(),
                    icon: provider.getProviderImageUrl(),
                    description: provider.getDescription(),
                    options: provider.getOptions(),
                    handlers
                })
            } catch (err) {
                // skip broken providers
            }
        }

        return res.send(results)
    }

    public static async syncStatus(req: UniqueRequest, res: Response, next: any) {
        try {
            const query = req.query
            const providerName = query.provider ? query.provider.toString() : undefined
            const providerId = query.providerId ? query.providerId.toString() : undefined

            const networkInstance = await Utils.getNetworkFromRequest(req)
            const syncManager = new SyncManager(networkInstance.context, req.requestId)
            const connections = await syncManager.getProviders(providerName, providerId)

            const result: Record<string, {
                connection: object,
                // sync
                handlers: SyncHandlerPosition[]
            }> = {}
            for (const connection of connections) {
                const handlerPositions: SyncHandlerPosition[] = []

                for (const handler of await connection.getSyncHandlers()) {
                    handlerPositions.push(await connection.getSyncPosition(handler.getName()))
                }

                const redactedConnection = connection.getConnection()
                delete redactedConnection['accessToken']
                delete redactedConnection['refreshToken']

                const uniqueId = `${connection.getProviderName()}:${connection.getProviderId()}`
                result[uniqueId] = {
                    connection: redactedConnection,
                    handlers: handlerPositions
                }
            }

            // @todo: catch and send errors
            return res.send({
                result,
                success: true
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    public static async disconnect(req: UniqueRequest, res: Response, next: any) {
        try {
            const providerName = req.params.provider
            const query = req.query
            const providerId = query.providerId ? query.providerId.toString() : undefined

            const networkInstance = await Utils.getNetworkFromRequest(req)
            const syncManager = new SyncManager(networkInstance.context, req.requestId)
            const connections = await syncManager.getProviders(providerName, providerId)
            if (!connections.length) {
                throw new Error(`Unable to locate connection: ${providerName} (${providerId})`)
            }

            const connection = connections[0]
            await connection.reset(false, true, true)

            return res.send({
                success: true
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    public static async logs(req: UniqueRequest, res: Response, next: any) {
        try {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders()
            // Tell the client to retry every 10 seconds if connectivity is lost
            res.write('retry: 10000\n\n')

            const query = req.query
            const networkInstance = await Utils.getNetworkFromRequest(req)

            const logsDs = await networkInstance.context.openDatastore(SCHEMA_SYNC_LOG)
            const logsDb = await logsDs.getDb()
            logsDb.changes(async (item: any) => {
                const record = await logsDs.getOne({
                    _id: item.id
                })
                res.write(`data: ${JSON.stringify(record)}\n\n`)
            })

            req.on('close', () => {
                Utils.closeConnection(networkInstance.did, req.requestId)
                res.end()
            });
        } catch (error) {
            console.log(error)
            res.status(400).send({
                error: error.message
            });
        }
    }

}