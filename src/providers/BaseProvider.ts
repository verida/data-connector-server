import { Request, Response } from 'express'
import { Utils } from '../utils'
import serverconfig from '../config'
import { AccountAuth, BaseProviderConfig, Connection, ConnectionOption, ConnectionProfile, SyncHandlerStatus, SyncProviderErrorEvent, SyncProviderLogEntry, SyncProviderLogLevel, SyncHandlerPosition, SyncSchemaPositionType, SyncStatus } from '../interfaces'
import { IContext, IDatastore } from '@verida/types'
import BaseSyncHandler from './BaseSyncHandler'
import { SchemaRecord } from '../schemas'

const SCHEMA_SYNC_POSITIONS = serverconfig.verida.schemas.SYNC_POSITION
const SCHEMA_SYNC_LOG = serverconfig.verida.schemas.SYNC_LOG
const SCHEMA_CONNECTION = serverconfig.verida.schemas.DATA_CONNECTIONS
const SYNC_REQUEST = serverconfig.verida.schemas.SYNC_REQUEST

export default class BaseProvider {

    protected config: BaseProviderConfig
    protected vault: IContext
    protected connection?: Connection
    protected connectionDs?: IDatastore
    protected syncPositionsDs?: IDatastore
    
    public constructor(config: BaseProviderConfig, vault?: IContext, connection?: Connection) {
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

    public getProviderName(): string {
        throw new Error('Not implemented')
    }

    public getProviderId(): string {
        if (!this.connection) {
            throw new Error('Unable to locate ID, provider is not connected')
        }

        return this.connection.providerId
    }

    public getProviderImageUrl(): string {
        return `${serverconfig.assetsUrl}/${this.getProviderName()}/icon.png`
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

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }
    
    public getProfile(): ConnectionProfile | undefined {
        return this.connection.profile
    }

    public async getDatastore(schemaUrl: string): Promise<IDatastore> {
        return this.vault.openDatastore(schemaUrl)
    }

    protected async logMessage(level: SyncProviderLogLevel, message: string, handlerName?: string, schemaUri?: string): Promise<void> {
        try {
            const syncLog = await this.vault.openDatastore(SCHEMA_SYNC_LOG)
            const logEntry: SyncProviderLogEntry = {
                message,
                level,
                providerName: this.getProviderName(),
                providerId: this.getProviderId(),
                handlerName,
                schemaUri,
                insertedAt: (new Date()).toISOString()
            }
            
            const result = await syncLog.save(logEntry, {})
            if (!result) {
                console.error(`Error logging message: ${syncLog.errors}`)
            }
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
                    const syncPositionId = Utils.buildSyncHandlerId(this.getProviderName(), this.getProviderId(), handler.getName(), SyncSchemaPositionType.SYNC)
                    await syncPositionsDs.delete(syncPositionId)
                } catch (err: any) {
                    // deleted already
                }
                try {
                    const syncBackfillId = Utils.buildSyncHandlerId(this.getProviderName(), this.getProviderId(), handler.getName(), SyncSchemaPositionType.SYNC)
                    await syncPositionsDs.delete(syncBackfillId)
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
        await this.logMessage(SyncProviderLogLevel.INFO, `Starting sync`)

        if (!accessToken) {
            const connection = this.getConnection()
            accessToken = connection.accessToken
            refreshToken = refreshToken ? refreshToken : connection.refreshToken
        }

        if (this.connection.syncStatus != SyncStatus.CONNECTED) {
            if (!force) {
                // Sync isn't active, so don't sync
                // @todo: handle retries if status = error
                // @todo: handle time delays for syncing
                await this.logMessage(SyncProviderLogLevel.INFO, `Sync isn't active (${this.connection.syncStatus}), so stopping`)
                return this.connection
            } else {
                await this.logMessage(SyncProviderLogLevel.INFO, `Sync isn't active, but forcing as requested`)
                this.connection.syncStatus = SyncStatus.CONNECTED
            }
        }

        this.connection.syncStatus = SyncStatus.SYNC_ACTIVE
        this.connection.syncStart = Utils.nowTimestamp()
        await this.saveConnection()

        const syncHandlers = await this.getSyncHandlers()
        const api = await this.getApi(accessToken, refreshToken)
        const syncPositionsDs = await this.vault.openDatastore(SCHEMA_SYNC_POSITIONS)
        const providerInstance = this

        let totalSyncItems = 0
        let totalBackfillItems = 0
        for (let h in syncHandlers) {
            let syncCount = 0
            const handler = syncHandlers[h]
            const schemaUri = handler.getSchemaUri()
            const datastore = await this.vault.openDatastore(schemaUri)

            const syncPosition = await this.getSyncPosition(handler.getName(), SyncSchemaPositionType.SYNC, syncPositionsDs)
            syncPosition.status = SyncHandlerStatus.ACTIVE
            const backfillPosition = await this.getSyncPosition(handler.getName(), SyncSchemaPositionType.BACKFILL, syncPositionsDs)
            backfillPosition.status = SyncHandlerStatus.ACTIVE

            handler.on('error', async (syncError: SyncProviderErrorEvent) => {
                await providerInstance.logMessage(SyncProviderLogLevel.ERROR, syncError.message, handler.getName(), schemaUri)
            })

            await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncing ${handler.getName()}`, handler.getName(),schemaUri)
            let syncResults = await handler.sync(api, syncPosition, backfillPosition, syncPositionsDs, datastore)
            totalSyncItems += syncResults.syncResults.length
            totalBackfillItems += syncResults.backfillResults.length
            await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncronized ${syncResults.syncResults.length} sync items and ${syncResults.backfillResults.length} backfill items`, handler.getName(), schemaUri)
            syncCount++

            while (!this.config.maxSyncLoops || syncCount < this.config.maxSyncLoops) {
                if (syncResults.syncPosition.status == SyncHandlerStatus.ACTIVE || syncResults.backfillPosition.status == SyncHandlerStatus.ACTIVE) {
                    // sync again
                    await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncing ${handler.getName()}`, handler.getName(), schemaUri)
                    syncResults = await handler.sync(api, syncPosition, backfillPosition, syncPositionsDs, datastore)
                    totalSyncItems += syncResults.syncResults.length
                    totalBackfillItems += syncResults.backfillResults.length
                    await this.logMessage(SyncProviderLogLevel.DEBUG, `Syncronized ${syncResults.syncResults.length} sync items and ${syncResults.backfillResults.length} backfill items`, handler.getName(), schemaUri)
                }

                syncCount++
            }
        }

        // Add latest profile info
        this.connection.profile = await this.getProfile()

        this.connection.syncStatus = SyncStatus.CONNECTED
        this.connection.syncEnd = Utils.nowTimestamp()
        await this.saveConnection()
        await this.logMessage(SyncProviderLogLevel.INFO, `Sync complete (${totalSyncItems} sync items, ${totalBackfillItems} backfill items)`)

        return this.connection
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

    public async getSyncPosition(handlerName: string, syncPositionType: SyncSchemaPositionType, syncPositionsDs?: IDatastore): Promise<SyncHandlerPosition> {
        if (!syncPositionsDs) {
            syncPositionsDs = await this.getSyncPositionsDs()
        }

        try {
            const id = Utils.buildSyncHandlerId(this.getProviderName(), this.getProviderId(), handlerName, SyncSchemaPositionType.SYNC)
            return await syncPositionsDs.get(id, {})

        } catch (err: any) {
            if (err.message.match('missing')) {
                // Schema position doesn't exist, so create new
                return {
                    _id: Utils.buildSyncHandlerId(this.getProviderName(), this.getProviderId(), handlerName, SyncSchemaPositionType.SYNC),
                    type: syncPositionType,
                    providerName: this.getProviderName(),
                    providerId: this.getProviderId(),
                    handlerName,
                    status: SyncHandlerStatus.ACTIVE
                }
            }

            throw err
        }
    }

    public async getSyncHandler(handler: typeof BaseSyncHandler): Promise<BaseSyncHandler> {
        return new handler(this.config, this.connection, this)
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
            
            const handlerInstance = new handler(this.config, this.connection, this)
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