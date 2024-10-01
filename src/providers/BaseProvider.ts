import { Request, Response } from 'express'
import { Utils } from '../utils'
import serverconfig from '../config'
import { BaseProviderConfig, Connection, ConnectionOption, ConnectionProfile, SyncHandlerStatus, SyncProviderLogEntry, SyncProviderLogLevel, SyncHandlerPosition, SyncStatus, SyncProviderLogEvent, ConnectionCallbackResponse, SyncFrequency, SyncHandlerResponse } from '../interfaces'
import { IContext, IDatastore } from '@verida/types'
import BaseSyncHandler from './BaseSyncHandler'
import { SchemaRecord } from '../schemas'
import EventEmitter from 'events'
import InvalidTokenError from './InvalidTokenError'
const _ = require("lodash")

const SCHEMA_SYNC_POSITIONS = serverconfig.verida.schemas.SYNC_POSITION
const SCHEMA_SYNC_LOG = serverconfig.verida.schemas.SYNC_LOG
const SCHEMA_CONNECTION = serverconfig.verida.schemas.DATA_CONNECTIONS
const MAX_ERROR_RETRIES = serverconfig.verida.maxHandlerRetries
const PROVIDER_TIMEOUT = serverconfig.verida.providerTimeoutMins

export default class BaseProvider extends EventEmitter {

    protected config: BaseProviderConfig
    protected vault: IContext
    protected connection?: Connection
    protected connectionDs?: IDatastore
    protected syncPositionsDs?: IDatastore
    
    public constructor(config: BaseProviderConfig, vault?: IContext, connection?: Connection) {
        super()
        this.config = config
        this.connection = connection
        this.vault = vault
    }

    public getConnection(): Connection {
        return this.connection!
    }

    public async saveConnection(): Promise<void> {
        if (!this.connection) {
            throw new Error('Unable to save connection, no connection object loaded')
        }

        delete this.connection['_rev']
        const connectionDs = await this.getConnectionDs()
        const saveResult = await connectionDs.save(this.connection, {
            forceUpdate: true
        })

        if (!saveResult) {
            throw new Error(`Unable to save connection: ${JSON.stringify(connectionDs.errors, null, 2)}`)
        }
    }

    public getConfig(): BaseProviderConfig {
        return this.config
    }

    public setConfig(config: BaseProviderConfig) {
        this.config = config
    }

    /**
     * @deprecated Use getProviderId()
     */
    public getProviderName(): string {
        throw new Error('Not implemented')
    }

    public getProviderId(): string {
        return this.getProviderName()
    }

    public getAccountId(): string {
        if (!this.connection) {
            throw new Error('Unable to locate ID, provider is not connected')
        }

        return this.connection.accountId
    }

    public getProviderImageUrl(): string {
        return `${serverconfig.assetsUrl}/${this.getProviderId()}/icon.png`
    }

    public getProviderLabel(): string {
        return this.config.label
    }

    public getProviderSbtImage(): string {
        return this.config.sbtImage
    }

    public getProviderApplicationUrl() {
        throw new Error('Not implemented')
    }

    public getDescription(): string {
        return ''
    }

    public getOptions(): ConnectionOption[] {
        return []
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
        throw new Error('Not implemented')
    }
    
    public getProfile(): ConnectionProfile | undefined {
        return this.connection.profile
    }

    public async getDatastore(schemaUrl: string): Promise<IDatastore> {
        return this.vault.openDatastore(schemaUrl)
    }

    protected async logMessage(level: SyncProviderLogLevel, message: string, handlerId?: string, schemaUri?: string): Promise<void> {
        try {
            const syncLog = await this.vault.openDatastore(SCHEMA_SYNC_LOG)
            const logEntry: SyncProviderLogEntry = {
                message,
                level,
                providerId: this.getProviderId(),
                accountId: this.getAccountId(),
                handlerId,
                schemaUri,
                insertedAt: (new Date()).toISOString()
            }
            
            const result = await syncLog.save(logEntry, {})
            if (!result) {
                console.error(`Error logging message: ${JSON.stringify(syncLog.errors, null, 2)}`)
            }

            this.emit('logMessage', logEntry)
        } catch (err: any) {
            console.error(`Error logging message: ${err.message}`)
        }
    }

    /**
     * Reset this provider by deleting all position information and data
     */
    public async reset(deleteData: boolean = false, deleteConnection: boolean = false, deleteSyncPositions: boolean = false): Promise<number> {
        const syncHandlers = await this.getSyncHandlers()

        let deletedRowCount = 0
        for (let h in syncHandlers) {
            const handler = syncHandlers[h]
            const schemaUri = handler.getSchemaUri()

            // delete sync positions
            if (deleteSyncPositions) {
                const syncPositionsDs = await this.vault.openDatastore(SCHEMA_SYNC_POSITIONS)
                try {
                    const syncPositionId = Utils.buildSyncHandlerId(this.getProviderId(), this.getAccountId(), handler.getId())
                    await syncPositionsDs.delete(syncPositionId)
                } catch (err: any) {
                    // deleted already
                }
            }
            
            // delete data
            if (deleteData) {
                const datastore = await this.vault.openDatastore(schemaUri)
                while (true) {
                    const rows = <SchemaRecord[]> await datastore.getMany({
                        sourceApplication: this.getProviderApplicationUrl()
                    })

                    if (rows.length == 0) {
                        break
                    }

                    for (let r in rows) {
                        await datastore.delete(rows[r]._id)
                        deletedRowCount++
                    }
                }
            }
        }

        // delete the connection?
        if (deleteConnection) {
            const connection = this.getConnection()
            const connectionDs = await this.vault.openDatastore(SCHEMA_CONNECTION)
            await connectionDs.delete(connection._id)
        }

        return deletedRowCount
    }

    /**
     * Syncronize all the latest data
     * 
     * @todo catch expired token error
     * 
     * @param accessToken 
     * @param refreshToken 
     * @param schemaUri 
     * @returns 
     */
    public async sync(accessToken?: string, refreshToken?: string, force: boolean = false): Promise<Connection> {
        // @todo: handle handler is in error state

        // Touch network, to ensure cache remains active
        const account = await this.vault.getAccount()
        await Utils.touchNetworkCache(await account.did())

        if (!accessToken) {
            const connection = this.getConnection()
            accessToken = connection.accessToken
            refreshToken = refreshToken ? refreshToken : connection.refreshToken
        }

        if (this.connection.syncStatus == SyncStatus.INVALID_AUTH) {
            return this.connection
        } else if (this.connection.syncStatus == SyncStatus.PAUSED) {
            await this.logMessage(SyncProviderLogLevel.WARNING, `Sync is paused, so not syncing`)
            this.connection.syncMessage = `Sync is paused, so not syncing`
            return this.connection
        }

        let forceHandlerSync = false
        if (force) {
            await this.logMessage(SyncProviderLogLevel.INFO, `Sync is being forced as requested`)
            this.connection.syncMessage = `Sync is being forced as requested`
            this.connection.syncStatus = SyncStatus.CONNECTED
            forceHandlerSync = true
        } else {
            // Check nextSync timestamp is in the past
            const now = (new Date()).toISOString()
            if (this.connection.syncNext > now) {
                // Sync isn't scheduled yet
                console.log('sync isnt scheduled yet ', this.connection.syncNext)
                await this.logMessage(SyncProviderLogLevel.INFO, `Sync isn't scheduled to run until ${this.connection.syncNext}`)
                return this.connection
            }

            if (this.connection.syncStatus == SyncStatus.ERROR) {
                await this.logMessage(SyncProviderLogLevel.DEBUG, `Sync has errors, so retrying`)
                this.connection.syncMessage = `Sync has errors, so retrying`
                // One or more handlers have an error, so retry
                this.connection.syncStatus = SyncStatus.CONNECTED
            } else if (this.connection.syncStatus == SyncStatus.ACTIVE) {
                // Sync is still active, check it hasn't timed out
                if (await this.isTimedOut()) {
                    await this.logMessage(SyncProviderLogLevel.ERROR, `Sync timeout has been detected, so reseting and initiating sync`)
                    this.connection.syncMessage = `Sync timeout has been detected, so resetting`
                    this.connection.syncStatus = SyncStatus.CONNECTED
                    forceHandlerSync = true
                } else {
                    await this.logMessage(SyncProviderLogLevel.INFO, `Sync is currently running, so not starting again`)
                    return this.connection
                }
            }
        }

        await this.logMessage(SyncProviderLogLevel.INFO, `Starting sync`)

        this.connection.syncStatus = SyncStatus.ACTIVE
        this.connection.syncStart = Utils.nowTimestamp()
        await this.saveConnection()

        const syncHandlers = await this.getSyncHandlers()
        const api = await this.getApi(accessToken, refreshToken)
        const syncPositionsDs = await this.vault.openDatastore(SCHEMA_SYNC_POSITIONS)
        const syncPromises = []
        const syncHandlerNames = []
        for (let h in syncHandlers) {
            const handler = syncHandlers[h]
            syncHandlerNames.push(handler.getId())
            syncPromises.push(this._syncHandler(handler, api, syncPositionsDs, forceHandlerSync))
        }

        const syncHandlerResults = await Promise.allSettled(syncPromises)
        this.connection.syncStatus = SyncStatus.CONNECTED
        for (const handlerResult of syncHandlerResults) {
            if (handlerResult.status == "rejected") {
                const err = handlerResult.reason
                if (err instanceof InvalidTokenError) {
                    this.connection.syncStatus = SyncStatus.INVALID_AUTH
                    this.connection.syncMessage = `Permission denied due to token expiry. Reconnect required.`
                    await this.logMessage(SyncProviderLogLevel.WARNING, this.connection.syncMessage)
                    break
                } else {
                    this.connection.syncStatus = SyncStatus.ERROR
                    this.connection.syncMessage = `Unknown error: ${err.message}`
                    await this.logMessage(SyncProviderLogLevel.ERROR, this.connection.syncMessage)
                }
            } else if (handlerResult.value.syncPosition.status == SyncHandlerStatus.ERROR) {
                this.connection.syncStatus = SyncStatus.ERROR
                this.connection.syncMessage = `One or more data sources had an error`
                await this.logMessage(SyncProviderLogLevel.ERROR, this.connection.syncMessage)
            }

            // @todo if handlerResult.value.syncPosition.status == SyncHandlerStatus.SYNCING -- do we sync the handler again or let it stop?
            // @todo if we do stop, change sync status to enabled
        }

        // Add latest profile info
        this.connection.profile = await this.getProfile()

        // Close any connections
        await this.close()

        this.setNextSync()

        this.connection.syncEnd = Utils.nowTimestamp()
        await this.saveConnection()
        await this.logMessage(SyncProviderLogLevel.INFO, `Sync complete for ${this.getProviderId()} (${syncHandlerNames.join(', ')})`)

        // @todo: do we sync again if needed?

        return this.connection
    }

    /**
     * Check if this provider has time out
     */
    protected async isTimedOut(): Promise<boolean> {
        // Check the sync log for this provider for an update in the past 15 minutes
        const syncLog = await this.vault.openDatastore(SCHEMA_SYNC_LOG)
        const cutoffTimestamp = new Date((new Date()).getTime() - PROVIDER_TIMEOUT * 1000 * 60).toISOString()
        
        const lastLog = await syncLog.getOne({
            providerId: this.getProviderId(),
            insertedAt: {
                "gte": cutoffTimestamp
            }
        }, {})

        if (lastLog) {
            console.log(`Log entry found in the past ${PROVIDER_TIMEOUT} minutes, so sync hasnt timedout`)
            return false
        }

        return true
    }

    protected setNextSync() {
        let syncFrequency = this.connection.syncFrequency
        let syncInterval: number

        const oneMinute = 1000 * 60     // 1 minute in milliseconds

        if (this.connection.syncStatus == SyncStatus.ERROR) {
            // If we had an error, retry in an hour
            syncFrequency = SyncFrequency.HOUR
        }

        switch (syncFrequency) {
            case 'hour':
                syncInterval = oneMinute * 60; // 1 hour
                break;
            case '3hour':
                syncInterval = oneMinute * 60 * 3; // 3 hours
                break;
            case '6hour':
                syncInterval = oneMinute * 60 * 6; // 6 hours
                break;
            case '12hour':
                syncInterval = oneMinute * 60 * 12; // 12 hours
                break;
            case 'day':
                syncInterval = oneMinute * 60 * 24; // 1 day
                break;
            case '3day':
                syncInterval = oneMinute * 60 * 24 * 3; // 3 days
                break;
            case 'week':
            default:
                syncInterval = oneMinute * 60 * 24 * 7; // 1 week
                break;
        }

        this.connection.syncNext = new Date((new Date()).getTime() + syncInterval).toISOString()
    }

    protected async _syncHandler(handler: BaseSyncHandler, api: any, syncPositionsDs: IDatastore, force: boolean = false): Promise<SyncHandlerResponse> {
        const providerInstance = this
        let syncCount = 0
        const schemaUri = handler.getSchemaUri()

        const syncPosition = await this.getSyncPosition(handler.getId(), syncPositionsDs)

        if (syncPosition.status == SyncHandlerStatus.INVALID_AUTH) {
            // If access is denied, don't even try to sync
            return {
                syncPosition,
                syncResults: []
            }
        }

        if (syncPosition.status == SyncHandlerStatus.SYNCING && !force) {
            await this.logMessage(SyncProviderLogLevel.INFO, `Sync is active for ${handler.getLabel()}, skipping`)
            console.log(`Sync is active for ${handler.getLabel()}, skipping`)
            return {
                syncPosition,
                syncResults: []
            }
        } else if (syncPosition.status == SyncHandlerStatus.ERROR) {
            if (syncPosition.errorRetries >= MAX_ERROR_RETRIES) {
                // Have hit maximum erorr retries, don't even try to sync
                return {
                    syncPosition,
                    syncResults: []
                }
            }

            syncPosition.errorRetries++
        } else {
            syncPosition.errorRetries = 0
        }

        syncPosition.status = SyncHandlerStatus.SYNCING
        
        handler.on('log', async (syncLog: SyncProviderLogEvent) => {
            await providerInstance.logMessage(syncLog.level, syncLog.message, handler.getId(), schemaUri)
        })

        await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncing ${handler.getId()}`, handler.getId(),schemaUri)
        let syncResults = await handler.sync(api, syncPosition, syncPositionsDs)
        await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncronized ${syncResults.syncResults.length} sync items`, handler.getId(), schemaUri)
        syncCount++

        while (!this.config.maxSyncLoops || syncCount < this.config.maxSyncLoops) {
            if (syncResults.syncPosition.status == SyncHandlerStatus.SYNCING) {
                // sync again
                await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncing ${handler.getId()}`, handler.getId(), schemaUri)
                syncResults = await handler.sync(api, syncPosition, syncPositionsDs)
                await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncronized ${syncResults.syncResults.length} sync items`, handler.getId(), schemaUri)
                await this.logMessage(SyncProviderLogLevel.DEBUG, syncResults.syncPosition.syncMessage, handler.getId(), schemaUri)
            }

            syncCount++
        }

        return syncResults
    }

    protected async getConnectionDs() {
        if (!this.connectionDs) {
            this.connectionDs = await this.vault.openDatastore(SCHEMA_CONNECTION)
        }

        return this.connectionDs
    }

    protected async getSyncPositionsDs() {
        if (!this.syncPositionsDs) {
            this.syncPositionsDs = await this.vault.openDatastore(SCHEMA_SYNC_POSITIONS)
        }

        return this.syncPositionsDs
    }

    public async getSyncPosition(handlerId: string, syncPositionsDs?: IDatastore): Promise<SyncHandlerPosition> {
        if (!syncPositionsDs) {
            syncPositionsDs = await this.getSyncPositionsDs()
        }

        try {
            const id = Utils.buildSyncHandlerId(this.getProviderId(), this.getAccountId(), handlerId)
            return await syncPositionsDs.get(id, {})

        } catch (err: any) {
            if (err.message.match('missing')) {
                // Schema position doesn't exist, so create new
                return {
                    _id: Utils.buildSyncHandlerId(this.getProviderId(), this.getAccountId(), handlerId),
                    providerId: this.getProviderId(),
                    accountId: this.getAccountId(),
                    handlerId,
                    errorRetries: 0,
                    status: SyncHandlerStatus.ENABLED
                }
            }

            throw err
        }
    }

    public async getSyncHandler(handler: typeof BaseSyncHandler): Promise<BaseSyncHandler> {
        return new handler({...this.config}, this.connection, this)
    }

    /**
     * Get all the available sync handlers
     * 
     * @param syncSchemas 
     * @param syncPositions 
     * @returns 
     */
    public async getSyncHandlers(): Promise<BaseSyncHandler[]> {
        const handlers = this.syncHandlers()
        const syncHandlers = []
        for (let h in handlers) {
            const handler = handlers[h]

            const handlerInstance = new handler({...this.config}, this.connection, this)
            syncHandlers.push(handlerInstance)
        }

        return syncHandlers
    }

    public updateConnection(connectionParams: object) {
        this.connection = {
            ...this.connection,
            ...connectionParams
        }
    }

    /**
     * Generate an api connection instance for communicating with this provider.
     * 
     * Must be implemented for each provider.
     * Must populate this.profile with the most up-to-date profile information for the account
     * 
     * @param req 
     */
    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        throw new Error('Not implemented')
    }

    /**
     * Close any connections
     */
    public async close(): Promise<void> {}

    /**
     * Override this with a list of sync handlers supported by this provider.
     * 
     * Each sync handler must be a class extending from `BaseSyncHandler`
     * 
     * @returns 
     */
    public syncHandlers(): typeof BaseSyncHandler[] {
        return []
    }

    public schemaUris(): string[] {
        const handlers = this.syncHandlers()
        const uris: string[] = []
        
        handlers.forEach((handler: typeof BaseSyncHandler) => {
            // @ts-ignore
            const instance = new handler({}, {})
            uris.push(instance.getSchemaUri())
        })

        return uris
    }
}