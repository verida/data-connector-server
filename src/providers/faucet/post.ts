import { SyncSchemaPosition, SyncStatus } from "../../interfaces";
import BaseSyncHandler from "../BaseSyncHandler";
import { SyncResponse } from "../../interfaces";

const FAKE_RESPONSES = [{
    _id: 0
},{
    _id: 1
},{
    _id: 2
},{
    _id: 3
},{
    _id: 4
},{
    _id: 5
},{
    _id: 6
},{
    _id: 7
},{
    _id: 8
},{
    _id: 9
},]

export default class Posts extends BaseSyncHandler {

    public async _sync(api: any, syncPosition: SyncSchemaPosition): Promise<SyncResponse> {
        if (!syncPosition.thisRef) {
            syncPosition.thisRef = "0"
        }

        const pageResults = FAKE_RESPONSES.slice(parseInt(syncPosition.thisRef), parseInt(syncPosition.thisRef) + this.config.limit)
        const results = this.buildResults(pageResults, syncPosition.breakId)

        if (!results) {
            // No results found, so stop sync
            syncPosition = this.stopSync(syncPosition)

            return {
                position: syncPosition,
                results: []
            }
        }

        syncPosition = this.setNextPosition(syncPosition, pageResults)

        if (results.length != this.config.limit) {
            // Not a full page of results, so stop sync
            syncPosition = this.stopSync(syncPosition)
        }

        return {
            results,
            position: syncPosition
        }
    }

    protected setNextPosition(syncPosition: SyncSchemaPosition, pageResults: any): SyncSchemaPosition {
        if (!syncPosition.futureBreakId && pageResults.length) {
            syncPosition.futureBreakId = pageResults[0]._id.toString()
        }

        if (pageResults[pageResults.length-1]._id != FAKE_RESPONSES[FAKE_RESPONSES.length-1]._id) {
            // Have more results, so set the next page ready for the next request
            syncPosition.thisRef = (pageResults[pageResults.length-1]._id + 1).toString()
        } else {
            // No more results, so stop sync
            syncPosition = this.stopSync(syncPosition)
        }

        return syncPosition
    }

    protected stopSync(syncPosition: SyncSchemaPosition): SyncSchemaPosition {
        syncPosition.status = SyncStatus.STOPPED
        syncPosition.thisRef = undefined
        syncPosition.breakId = syncPosition.futureBreakId
        syncPosition.futureBreakId = undefined

        return syncPosition
    }

    protected buildResults(items: any[], breakId: string): any[] {
        const results = []
        for (let i in items) {
            if (items[i]._id == breakId) {
                break
            }

            results.push(items[i])
        }

        return results
    }

}