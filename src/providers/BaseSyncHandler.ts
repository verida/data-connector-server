import { Connection, SyncHandlerResponse, SyncHandlerStatus, SyncProviderLogLevel, SyncResponse, SyncSchemaPosition } from "../interfaces"
import { IDatastore } from '@verida/types'
import { EventEmitter } from "events"
import { Utils } from "../utils"
import { SchemaRecord } from "../schemas"
import BaseProvider from "./BaseProvider"

export default class BaseSyncHandler extends EventEmitter {

    protected provider: BaseProvider
    protected config: any
    protected connection: Connection

    protected syncStatus: SyncHandlerStatus

    constructor(config: any, connection: Connection, provider: BaseProvider) {
        super()
        this.config = config
        this.connection = connection
        this.provider = provider
    }

    public getConfig(): any {
        return this.config
    }

    public setConfig(config: any) {
        this.config = config
    }

    public getSchemaUri(): string {
        throw new Error('Not implemented')
    }

    /**
     * Continuously syncronize the data in batches, until complete.
     * 
     * Saves the data.
     * 
     * @param api 
     * @param syncPosition 
     * @param syncSchemaPositionDs 
     * @returns 
     */
    public async sync(
        api: any,
        syncPosition: SyncSchemaPosition,
        backfillPosition: SyncSchemaPosition,
        syncSchemaPositionDs: IDatastore,
        schemaDatastore: IDatastore): Promise<SyncHandlerResponse> {
        const promises = []
        promises.push(this._sync(api, syncPosition))
        promises.push(this._backfill(api, backfillPosition))

        const promiseResults = await Promise.allSettled(promises)
        const syncResult = promiseResults[0]
        const backfillResult = promiseResults[1]

        let syncResults: SchemaRecord[] = []
        let backfillResults: SchemaRecord[] = []
        if (syncResult.status == 'fulfilled')  {
            syncResults = <SchemaRecord[]> syncResult.value.results
            await this.handleResults(syncResult.value.position, syncResults, syncSchemaPositionDs)
        } else {
            const message = `Unknown error handling sync results: ${syncResult.reason}`
            this.emit('error', {
                level: SyncProviderLogLevel.ERROR,
                message
            })
        }

        if (backfillResult.status == 'fulfilled')  {
            backfillResults = <SchemaRecord[]> backfillResult.value.results
            await this.handleResults(backfillResult.value.position, backfillResults, syncSchemaPositionDs)
        } else {
            const message = `Unknown error handling backfill results: ${backfillResult.reason}`
            this.emit('error', {
                level: SyncProviderLogLevel.ERROR,
                message
            })
        }

        return {
            syncPosition,
            backfillPosition,
            syncResults,
            backfillResults
        }
    }

    protected async handleResults(
        position: SyncSchemaPosition,
        items: SchemaRecord[],
        syncSchemaPositionDs: IDatastore
        ): Promise<void> {
        try {
            // Ensure we always update, so delete any revision value
            delete position['_rev']
            const result = await syncSchemaPositionDs.save(position, {
                // The position record may already exist, if so, force update
                forceUpdate: true
            })
        } catch (err: any) {
            const message = `Unable to update sync position: ${err.message} (${JSON.stringify(position, null, 2)})`
            this.emit('error', {
                level: SyncProviderLogLevel.ERROR,
                message
            })
        }

        // save items
        for (let i in items) {
            const item = items[i]
            if (!item.insertedAt) {
                const message = `Unable to save item: insertedAt field is missing (${JSON.stringify(item, null, 2)})`
                this.emit('error', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })
                continue
            }

            const schemaDatastore = await this.provider.getDatastore(item.schema)

            try {
                const success = await schemaDatastore.save(item, {})
                if (!success) {
                    const message = `Unable to save item: ${Utils.datastoreErorrsToString(schemaDatastore.errors)} (${JSON.stringify(item, null, 2)})`

                    this.emit('error', {
                        level: SyncProviderLogLevel.ERROR,
                        message
                    })
                }
            } catch (err: any) {
                const message = `Unable to save item: ${err.message} (${JSON.stringify(item, null, 2)})`
                this.emit('error', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })
            }
        }
    }

    /**
     * Syncronize the most recent data to the oldest data.
     * 
     * This must be implemented by the sync handler.
     * 
     * @returns SyncResponse Array of results that need to be saved and the updated syncPosition
     */
    public async _sync(api: any, syncPosition: SyncSchemaPosition): Promise <SyncResponse> {
        throw new Error('Not implemented')
    }

    /**
     * Backfill to add extra detail to these records
     * 
     * This can be implemented by the sync handler.
     * 
     * @returns SyncResponse Array of results that need to be saved and the updated syncPosition
     */
    protected async _backfill(api: any, backfillPosition: SyncSchemaPosition): Promise<SyncResponse> {
        backfillPosition.status = SyncHandlerStatus.STOPPED

        return {
            position: backfillPosition,
            results: []
        }
    }

    /**
     * Update the `syncPosition` when the sync has stopped.
     * 
     * This can be implemented by the sync handler.
     * 
     * @param syncPosition 
     * @param serverResponse 
     */
    protected stopSync(syncPosition: SyncSchemaPosition, serverResponse?: any): SyncSchemaPosition {
        return syncPosition
    }
}