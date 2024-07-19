import { SyncSchemaPosition, SyncHandlerStatus } from "../../interfaces";
import BaseSyncHandler from "../BaseSyncHandler";
import { SyncResponse } from "../../interfaces";
import CONFIG from '../../config'

// Required fields in the post schema
const FAKE_ITEM = {
    name: 'Fake item',
    uri: 'http://www.fake.com/'
}

const FAKE_RESPONSES = [{
    ...FAKE_ITEM,
    _id: "1"
},{
    ...FAKE_ITEM,
    _id: "2"
},{
    ...FAKE_ITEM,
    _id: "3"
},{
    ...FAKE_ITEM,
    _id: "4"
},{
    ...FAKE_ITEM,
    _id: "5"
},{
    ...FAKE_ITEM,
    _id: "6"
},{
    ...FAKE_ITEM,
    _id: "7"
},{
    ...FAKE_ITEM,
    _id: "8"
},{
    ...FAKE_ITEM,
    _id: "9"
},{
    ...FAKE_ITEM,
    _id: "10"
}]

export default class Posts extends BaseSyncHandler {

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.POST
    }

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
            syncPosition.futureBreakId = pageResults[0]._id
        }

        if (pageResults[pageResults.length-1]._id != FAKE_RESPONSES[FAKE_RESPONSES.length-1]._id) {
            // Have more results, so set the next page ready for the next request
            syncPosition.thisRef = pageResults[pageResults.length-1]._id
        } else {
            // No more results, so stop sync
            syncPosition = this.stopSync(syncPosition)
        }

        return syncPosition
    }

    protected stopSync(syncPosition: SyncSchemaPosition): SyncSchemaPosition {
        if (syncPosition.status == SyncHandlerStatus.STOPPED) {
            return syncPosition
        }

        syncPosition.status = SyncHandlerStatus.STOPPED
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

            results.push({
                ...items[i],
                insertedAt: new Date().toISOString()
            })
        }

        return results
    }

}