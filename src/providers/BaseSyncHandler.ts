import { AccountProfile, SyncHandlerStatus, SyncProviderLogLevel, SyncResponse, SyncSchemaPosition } from "../interfaces"
import { IDatastore } from '@verida/types'
import { EventEmitter } from "events"
import { Utils } from "../utils"
import { SchemaRecord } from "../schemas"

export default class BaseSyncHandler extends EventEmitter {

    protected config: any
    protected profile: AccountProfile

    protected syncStatus: SyncHandlerStatus

    constructor(config: any, profile: AccountProfile) {
        super()
        this.config = config
        this.profile = profile
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
    public async sync(api: any, syncPosition: SyncSchemaPosition, backfillPosition: SyncSchemaPosition, syncSchemaPositionDs: IDatastore, schemaDatastore: IDatastore): Promise<void> {
        const promises = []
        promises.push(this._sync(api, syncPosition))
        promises.push(this._backfill(api, backfillPosition))

        const promiseResults = await Promise.allSettled(promises)
        const syncResult = promiseResults[0]
        const backfillResult = promiseResults[1]

        // handle sync result
        if (syncResult.status == 'fulfilled') {
            // save updated sync position
            const position = syncResult.value.position

            try {
                // Ensure we always update, so delete any revision value
                delete position['_rev']
                await syncSchemaPositionDs.save(position, {
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
            const items = <SchemaRecord[]> syncResult.value.results
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
        } else {
            const message = `Unknown error with sync: ${syncResult.reason}`
            this.emit('error', {
                level: SyncProviderLogLevel.ERROR,
                message
            })
        }

        // handle backfill result
        // if (backfillResult.status == 'fulfilled') {
        //     console.log('backfill result')
        //     console.log(backfillResult.value)
        // } else {
        //     // @todo: handle error
        //     throw Error(backfillResult.reason)
        // }
        

        // @todo: sync again if required (check this.config.maxSyncLoops) -- provider should manage this?
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
     * Backfill to add extra detail to 
     * 
     * This can be implemented by the sync handler.
     * 
     * @returns SyncResponse Array of results that need to be saved and the updated syncPosition
     */
    protected async _backfill(api: any, backfillPosition: SyncSchemaPosition): Promise<SyncResponse> {
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