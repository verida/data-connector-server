import { Request, Response } from 'express'
import Providers from "../../../../providers"
import SyncManager from '../../../../sync-manager'
import { BaseHandlerConfig, ConnectionHandler, ProviderHandler, SyncHandlerPosition, SyncStatus, UniqueRequest } from '../../../../interfaces'
import { Utils } from '../../../../utils'
import CONFIG from '../../../../config'
import BaseSyncHandler from '../../../../providers/BaseSyncHandler'

const log4js = require("log4js")
const logger = log4js.getLogger()

const SCHEMA_SYNC_LOG = CONFIG.verida.schemas.SYNC_LOG

export interface UpdateConnectionParams {
    syncStatus: SyncStatus
    handlerConfig: Record<string, Record<string, object>>
    handlerEnabled: Record<string, boolean>
}

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
        const {
            provider,
            providerId,
            forceSync
        } = req.body

        const networkInstance = await Utils.getNetworkFromRequest(req)
        const syncManager = new SyncManager(networkInstance.context, req.requestId)
        const connections = await syncManager.sync(provider, providerId ? providerId.toString() : undefined, forceSync)

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

    public static async connections(req: UniqueRequest, res: Response, next: any) {
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

    public static async update(req: UniqueRequest, res: Response) {
        try {
            const connectionId = req.params.connectionId
            const networkInstance = await Utils.getNetworkFromRequest(req)
            const syncManager = new SyncManager(networkInstance.context, req.requestId)

            const connection = await syncManager.getConnection(connectionId)
            const provider = await syncManager.getProvider(connectionId)
            if (!connection) {
                throw new Error(`Unable to locate connection: ${connectionId})`)
            }

            const data = <UpdateConnectionParams> req.body

            // Handle updates to sync status
            const validSyncStatus = [SyncStatus.CONNECTED, SyncStatus.PAUSED]
            if (data.syncStatus) {
                if (validSyncStatus.indexOf(data.syncStatus) === -1) {
                    throw new Error(`Invalid sync status (${data.syncStatus}) not in ${JSON.stringify(validSyncStatus)}`)
                }

                connection.syncStatus = data.syncStatus
            }

            // Handle updates to config
            const handlers = (await provider.getSyncHandlers()).reduce((handlers: Record<string, BaseSyncHandler>, handler: BaseSyncHandler) => {
                handlers[handler.getName()] = handler
                return handlers
            }, {})

            const handlerConfigs = (await connection.handlers).reduce((handlers: Record<string, ConnectionHandler>, handler: ConnectionHandler) => {
                handlers[handler.name] = handler
                return handlers
            }, {})

            const updatedHandlers = []
            if (data.handlerConfig) {
                for (const handlerId in data.handlerConfig) {
                    if (handlers[handlerId]) {
                        continue
                    }

                    let isEnabled = handlerConfigs[handlerId].enabled
                    isEnabled = data.handlerEnabled && typeof(data.handlerEnabled[handlerId]) === "boolean" ? data.handlerEnabled[handlerId] : isEnabled

                    updatedHandlers.push({
                        name: handlerId,
                        enabled: isEnabled,
                        config: handlers[handlerId].buildConfig(data.handlerConfig[handlerId])
                    })
                }

                connection.handlers = updatedHandlers
            }

            provider.updateConnection(connection)
            await provider.saveConnection()

            return res.send({
                success: true
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    public static async disconnect(req: UniqueRequest, res: Response, next: any) {
        try {
            const connectionId = req.params.connectionId
            const networkInstance = await Utils.getNetworkFromRequest(req)
            const syncManager = new SyncManager(networkInstance.context, req.requestId)

            const connection = await syncManager.getProvider(connectionId)
            if (!connection) {
                throw new Error(`Unable to locate connection: ${connectionId})`)
            }

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