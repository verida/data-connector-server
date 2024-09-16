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