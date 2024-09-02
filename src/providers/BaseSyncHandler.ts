import { Connection, HandlerOption, SyncHandlerResponse, SyncHandlerStatus, SyncProviderLogLevel, SyncResponse, SyncHandlerPosition } from "../interfaces"
import { IDatastore } from '@verida/types'
import { EventEmitter } from "events"
import { Utils } from "../utils"
import { SchemaRecord } from "../schemas"
import BaseProvider from "./BaseProvider"
const _ = require("lodash")

export default class BaseSyncHandler extends EventEmitter {

    protected provider: BaseProvider
    protected config: any
    protected connection: Connection

    protected syncStatus: SyncHandlerStatus

    constructor(config: any, connection: Connection, provider: BaseProvider) {
        super()
        // Handle any custom config for this handler
        if (config.handlers) {
            if (config.handlers[this.getName()]) {
                config = _.merge({}, config, config.handlers[this.getName()])
            }

            delete config["handlers"]
        }

        this.config = config
        this.connection = connection
        this.provider = provider
    }

    public getName(): string {
        throw new Error('Not implemented')
    }

    public getConfig(): any {
        return this.config
    }

    public getOptions(): HandlerOption[] {
        return []
    }

    public setConfig(config: any) {
        this.config = config
    }

    public getProviderApplicationUrl() {
        return this.provider.getProviderApplicationUrl()
    }

    public getSchemaUri(): string {
        throw new Error('Not implemented')
    }

    protected updateConnection(connectionParams: object) {
        this.provider.updateConnection(connectionParams)
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
        syncPosition: SyncHandlerPosition,
        syncSchemaPositionDs: IDatastore): Promise<SyncHandlerResponse> {
        
        let syncResults
        try {
            const syncResult = await this._sync(api, syncPosition)
            syncResults = <SchemaRecord[]> syncResult.results
            await this.handleResults(syncResult.position, syncResults, syncSchemaPositionDs)
        }
        catch (err: any) {
            const message = `Unknown error handling sync results: ${err.message}`
            this.emit('log', {
                level: SyncProviderLogLevel.ERROR,
                message
            })
        }

        return {
            syncPosition,
            syncResults
        }
    }

    protected async handleResults(
        position: SyncHandlerPosition,
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
            if (!result) {
                const message = `Unable to update sync position: ${JSON.stringify(syncSchemaPositionDs.errors, null, 2)} (${JSON.stringify(position, null, 2)})`
                this.emit('log', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })
            }
        } catch (err: any) {
            const message = `Unable to update sync position: ${err.message} (${JSON.stringify(position, null, 2)})`
            this.emit('log', {
                level: SyncProviderLogLevel.ERROR,
                message
            })
        }

        // save items
        for (let i in items) {
            const item = items[i]
            if (!item.insertedAt) {
                const message = `Unable to save item: insertedAt field is missing (${item._id}})`
                this.emit('log', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })
                continue
            }

            // Load schema specified in item, fallback to default schema for this sync handler
            // This allows a sync handler to return results of different schema types
            if (!item.schema) {
                item.schema = this.getSchemaUri()
            }
            
            const schemaDatastore = await this.provider.getDatastore(item.schema)

            try {
                const success = await schemaDatastore.save(item, {
                    forceUpdate: true
                })
                if (!success) {
                    // @ts-ignore
                    const message = `Unable to save item: ${Utils.datastoreErrorsToString(schemaDatastore.errors)} (${item._id} / ${item._rev})`

                    this.emit('log', {
                        level: SyncProviderLogLevel.ERROR,
                        message
                    })
                }
            } catch (err: any) {
                const message = `Unable to save item: ${err.message} (${item._id} / ${item._rev})`
                this.emit('log', {
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
    public async _sync(api: any, syncPosition: SyncHandlerPosition): Promise <SyncResponse> {
        throw new Error('Not implemented')
    }

    /**
     * Backfill to add extra detail to these records
     * 
     * This can be implemented by the sync handler.
     * 
     * @returns SyncResponse Array of results that need to be saved and the updated syncPosition
     */
    protected async _backfill(api: any, backfillPosition: SyncHandlerPosition): Promise<SyncResponse> {
        backfillPosition.status = SyncHandlerStatus.ENABLED

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
    protected stopSync(syncPosition: SyncHandlerPosition, serverResponse?: any): SyncHandlerPosition {
        return syncPosition
    }

    protected buildItemId(itemId: string) {
        return `${this.provider.getProviderName()}-${this.connection.profile.id}-${itemId}`
    }
}