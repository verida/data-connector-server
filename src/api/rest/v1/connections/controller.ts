import { Response } from 'express'
import SyncManager from '../../../../sync-manager'
import { ConnectionHandler, SyncFrequency, SyncHandlerPosition, SyncStatus, UniqueRequest } from '../../../../interfaces'
import { Utils } from '../../../../utils'
import CONFIG from '../../../../config'
import BaseSyncHandler from '../../../../providers/BaseSyncHandler'

const log4js = require("log4js")
const logger = log4js.getLogger()

const SCHEMA_SYNC_LOG = CONFIG.verida.schemas.SYNC_LOG

export interface UpdateConnectionParams {
    syncStatus: SyncStatus
    syncFrequency: SyncFrequency
    handlerConfig: Record<string, Record<string, object | boolean>>
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
        try {
            const {
                forceSync,
                instantComplete
            } = req.body

            const networkInstance = req.veridaNetworkConnection
            const syncManager = new SyncManager(networkInstance.context, req.requestId)

            if (instantComplete) {
                syncManager.sync(undefined, undefined, forceSync)

                return res.send({
                    success: true
                })
            } else {
                const connections = await syncManager.sync(undefined, undefined, forceSync)

                return res.send({
                    connections,
                    success: true
                })
            }
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    public static async syncConnection(req: UniqueRequest, res: Response, next: any) {
        try {
            const connectionId = req.params.connectionId
            const {
                instantComplete,
                forceSync
            } = req.body

            const networkInstance = req.veridaNetworkConnection
            const syncManager = new SyncManager(networkInstance.context, req.requestId)
            const connection = await syncManager.getConnection(connectionId)

            if (instantComplete) {
                syncManager.sync(connection.providerId, connection.accountId, forceSync)

                return res.send({
                    success: true
                })
            } else {
                const connections = await syncManager.sync(connection.providerId, connection.accountId, forceSync)

                return res.send({
                    connections,
                    success: true
                })
            }
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    public static async connections(req: UniqueRequest, res: Response, next: any) {
        try {
            const query = req.query
            const providerId = query.providerId ? query.providerId.toString() : undefined
            const accountId = query.accountId ? query.accountId.toString() : undefined

            const networkInstance = req.veridaNetworkConnection
            const syncManager = new SyncManager(networkInstance.context, req.requestId)
            const connections = await syncManager.getProviders(providerId, accountId)

            const result: Record<string, any> = {}
            for (const connection of connections) {
                const handlerPositions: Record<string, SyncHandlerPosition> = {}

                for (const handler of await connection.getSyncHandlers()) {
                    handlerPositions[handler.getId()] = await connection.getSyncPosition(handler.getId())
                }

                const redactedConnection = connection.getConnection()
                delete redactedConnection['accessToken']
                delete redactedConnection['refreshToken']

                for (const i in redactedConnection.handlers) {
                    const handler = redactedConnection.handlers[i]
                    const handlerPosition = handlerPositions[handler.id]

                    if (handlerPosition) {
                        redactedConnection.handlers[i] = {
                            ...handler,
                            ...handlerPosition
                        }
                    }
                }

                const uniqueId = `${connection.getProviderId()}:${connection.getAccountId()}`
                result[uniqueId] = redactedConnection
            }

            // @todo: catch and send errors
            return res.send({
                items: result,
                success: true
            })
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    public static async update(req: UniqueRequest, res: Response) {
        try {
            const connectionId = req.params.connectionId
            const networkInstance = req.veridaNetworkConnection
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
                    throw new Error(`Invalid sync status (${data.syncStatus}) not in [${validSyncStatus.join(', ')}]`)
                }

                connection.syncStatus = data.syncStatus
            }

            const validFrequencyStatus = Object.values(SyncFrequency)
            if (data.syncFrequency) {
                if (validFrequencyStatus.indexOf(data.syncFrequency) === -1) {
                    throw new Error(`Invalid sync frequency (${data.syncFrequency}) not in [${validFrequencyStatus.join(', ')}]`)
                }

                connection.syncFrequency = data.syncFrequency
            }

            // Handle updates to config
            const handlers = (await provider.getSyncHandlers()).reduce((handlers: Record<string, BaseSyncHandler>, handler: BaseSyncHandler) => {
                handlers[handler.getName()] = handler
                return handlers
            }, {})

            const handlerConfigs = (await connection.handlers).reduce((handlers: Record<string, ConnectionHandler>, handler: ConnectionHandler) => {
                handlers[handler.id] = handler
                return handlers
            }, {})

            const updatedHandlers = []
            if (data.handlerConfig) {
                for (const handlerId in data.handlerConfig) {
                    if (!handlers[handlerId]) {
                        continue
                    }

                    let isEnabled = handlerConfigs[handlerId] ? handlerConfigs[handlerId].enabled : true
                    isEnabled = typeof(data.handlerConfig[handlerId].enabled) === "boolean" ? <boolean> data.handlerConfig[handlerId].enabled : isEnabled

                    delete data.handlerConfig[handlerId]['enabled']

                    updatedHandlers.push({
                        id: handlerId,
                        enabled: isEnabled,
                        config: handlers[handlerId].buildConfig(<Record<string, object>> data.handlerConfig[handlerId], handlerConfigs[handlerId] && handlerConfigs[handlerId].config ? handlerConfigs[handlerId].config : {})
                    })
                }

                connection.handlers = updatedHandlers
            }

            provider.updateConnection(connection)
            await provider.saveConnection()

            if (!data.handlerConfig && !data.syncStatus) {
                return res.status(500).send({
                    success: false,
                    message: `Nothing updated`
                })
            } else {
                return res.send({
                    success: true,
                    syncStatus: connection.syncStatus,
                    syncFrequency: connection.syncFrequency,
                    handlers: connection.handlers
                })
            }
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    public static async disconnect(req: UniqueRequest, res: Response, next: any) {
        try {
            const connectionId = req.params.connectionId
            const networkInstance = req.veridaNetworkConnection
            const syncManager = new SyncManager(networkInstance.context, req.requestId)

            const connection = await syncManager.getProvider(connectionId)
            if (!connection) {
                throw new Error(`Unable to locate connection: ${connectionId}`)
            }

            await connection.reset(false, true, true)

            return res.send({
                success: true
            })
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
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

            // const query = req.query
            const networkInstance = req.veridaNetworkConnection

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
            res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

}
