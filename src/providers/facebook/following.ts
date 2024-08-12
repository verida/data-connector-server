import BaseSyncHandler from "../BaseSyncHandler"
import CONFIG from '../../config'
const { Facebook } = require('fb')

import url from 'url'
import { SyncResponse, SyncHandlerPosition, SyncHandlerStatus } from "../../interfaces"
import { SchemaFollowing } from "../../schemas"

const _ = require('lodash')

export default class Following extends BaseSyncHandler {

    protected apiEndpoint = '/me/likes'

    public getName(): string {
        return 'following'
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.FOLLOWING
    }

    public async _sync(Fb: typeof Facebook, syncPosition: SyncHandlerPosition): Promise<SyncResponse> {
        if (!syncPosition.thisRef) {
            syncPosition.thisRef = `${this.apiEndpoint}?limit=${this.config.followingBatchSize}`
        }

        const pageResults = await Fb.api(syncPosition.thisRef)

        if (!pageResults || !pageResults.data.length) {
            // No results found, so stop sync
            syncPosition = this.stopSync(syncPosition)

            return {
                position: syncPosition,
                results: []
            }
        }

        const results = this.buildResults(pageResults.data, syncPosition.breakId)
        syncPosition = this.setNextPosition(syncPosition, pageResults)

        if (results.length != this.config.followingBatchSize) {
            // Not a full page of results, so stop sync
            syncPosition = this.stopSync(syncPosition)
        }

        return {
            results,
            position: syncPosition
        }
    }

    protected stopSync(syncPosition: SyncHandlerPosition): SyncHandlerPosition {
        if (syncPosition.status == SyncHandlerStatus.STOPPED) {
            return syncPosition
        }
        
        syncPosition.status = SyncHandlerStatus.STOPPED
        syncPosition.thisRef = undefined
        syncPosition.breakId = syncPosition.futureBreakId
        syncPosition.futureBreakId = undefined

        return syncPosition
    }

    protected setNextPosition(syncPosition: SyncHandlerPosition, serverResponse: any): SyncHandlerPosition {
        if (!syncPosition.futureBreakId && serverResponse.data.length) {
            syncPosition.futureBreakId = serverResponse.data[0].id
        }

        if (_.has(serverResponse, 'paging.next')) {
            // Have more results, so set the next page ready for the next request
            const next = serverResponse.paging.next
            const urlParts = url.parse(next, true)
            syncPosition.thisRef = `${this.apiEndpoint}${urlParts.search}`
        } else {
            console.log('following: stopping, no next page')
            syncPosition = this.stopSync(syncPosition)
        }

        return syncPosition
    }

    protected buildResults(pageResults: any, breakId: string): SchemaFollowing[] {
        const results = []
        for (var r in pageResults) {
            const like = pageResults[r]

            if(like.id == breakId) {
                // Break if the ID matches the record we are breaking on
                break
            }

            const uriName = like.name.replace(/ /g, '-')
            const followedTimestamp = like.created_time ? like.created_time : new Date().toISOString()

            results.push({
                _id: this.buildItemId(like.id),
                icon: `https://graph.facebook.com/${like.id}/picture`,
                name: like.name,
                uri: `https://facebook.com/${uriName}-${like.id}`,
                sourceApplication: 'https://facebook.com/',
                sourceId: like.id,
                sourceData: like,
                followedTimestamp,
                insertedAt: followedTimestamp
            })
        }

        return results
    }

}