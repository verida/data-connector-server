import { AccountProfile, SyncHandlerMode, SyncSchemaPosition, SyncStatus } from "../interfaces"
import { IDatastore } from '@verida/types'

export default class BaseSyncHandler {

    protected config: any
    protected profile: AccountProfile

    protected syncStatus: SyncStatus

    constructor(config: any, profile: AccountProfile) {
        this.config = config
        this.profile = profile
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
    public async sync(api: any, syncPosition: SyncSchemaPosition, syncSchemaPositionDs: IDatastore): Promise<void> {
        // @todo: check if snapshot is complete

        if (syncPosition.mode == SyncHandlerMode.SNAPSHOT) {
            const results = await this.syncSnapshot(api, syncPosition)
            await syncSchemaPositionDs.save(syncPosition, {})

            // @todo: save results

            if (syncPosition.status == SyncStatus.ACTIVE) {
                // Sync is still active, so go again
                return await this.sync(api, syncPosition, syncSchemaPositionDs)
            } else {
                // Sync has ended, so initiate an update
                syncPosition.mode = SyncHandlerMode.UPDATE
                await this.syncUpdate(api, syncPosition)
                return
            }
        } else {
            const results = await this.syncUpdate(api, syncPosition)
            await syncSchemaPositionDs.save(syncPosition, {})

            // @todo: save results

            if (syncPosition.status == SyncStatus.ACTIVE) {
                // Sync is still active, so go again
                await this.syncUpdate(api, syncPosition)
                return
            } else {
                // Sync has ended, so end
                this.syncStatus = SyncStatus.STOPPED
            }
        }
    }

    /**
     * Work backwards, syncronizing the most recent data to the oldest data
     * 
     * @returns object[] Array of results that need to be saved
     */
    public async syncSnapshot(api: any, syncPosition: SyncSchemaPosition): Promise <object[]> {
        throw new Error('Not implemented')
    }

    /**
     * Syncronize any new data since the last syncronization occurred
     * 
     * @returns object[] Array of results that need to be saved
     */
    public async syncUpdate(api: any, syncPosition: SyncSchemaPosition): Promise <object[]> {
        throw new Error('Not implemented')
    }
}