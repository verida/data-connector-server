import { AccountProfile, SyncResponse, SyncSchemaPosition, SyncStatus } from "../interfaces"
import { IDatastore } from '@verida/types'

export default class BaseSyncHandler {

    protected config: any
    protected profile: AccountProfile

    protected syncStatus: SyncStatus

    constructor(config: any, profile: AccountProfile) {
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
    public async sync(api: any, syncPosition: SyncSchemaPosition, backfillPosition: SyncSchemaPosition, syncSchemaPositionDs: IDatastore): Promise<void> {
        const promises = []
        promises.push(this._sync(api, syncPosition))
        promises.push(this._backfill(api, backfillPosition))

        const promiseResults = await Promise.all(promises)
        
        for (let p in promiseResults) {
            const result = promiseResults[p]
            
        }

        // @todo: save results
        // @todo: sync again if required (check this.config.maxSyncLoops)

        

        // if (syncPosition.mode == SyncHandlerMode.SNAPSHOT) {
        //     const results = await this.syncSnapshot(api, syncPosition)
        //     await syncSchemaPositionDs.save(syncPosition, {})

        //     // @todo: save results

        //     if (syncPosition.status == SyncStatus.ACTIVE) {
        //         // Sync is still active, so go again
        //         return await this.sync(api, syncPosition, syncSchemaPositionDs)
        //     } else {
        //         // Sync has ended, so initiate an update
        //         syncPosition.mode = SyncHandlerMode.UPDATE
        //         await this.syncUpdate(api, syncPosition)
        //         return
        //     }
        // } else {
        //     const results = await this.syncUpdate(api, syncPosition)
        //     await syncSchemaPositionDs.save(syncPosition, {})

        //     // @todo: save results

        //     if (syncPosition.status == SyncStatus.ACTIVE) {
        //         // Sync is still active, so go again
        //         await this.syncUpdate(api, syncPosition)
        //         return
        //     } else {
        //         // Sync has ended, so end
        //         this.syncStatus = SyncStatus.STOPPED
        //     }
        // }
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