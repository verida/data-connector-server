import BaseSyncHandler from "../BaseSyncHandler"
import CONFIG from '../../config'
const { Facebook } = require('fb')

import url from 'url'
import { SyncHandlerMode, SyncResponse, SyncSchemaPosition, SyncStatus } from "../../interfaces"
import { SchemaFollowing } from "../../schemas"

const _ = require('lodash')

export default class Following extends BaseSyncHandler {

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.FOLLOWING
    }

    public async syncSnapshot(Fb: typeof Facebook, syncPosition: SyncSchemaPosition): Promise<SyncResponse> {
        const apiEndpoint = '/me/likes'

        if (!syncPosition.next) {
            syncPosition.next = `${apiEndpoint}?limit=${this.config.followingLimit}`
        }

        const pageResults = await Fb.api(syncPosition.next)

        if (_.has(pageResults, 'paging.next')) {
            // Have more results, so set the next page ready for the next request
            const next = pageResults.paging.next
            const urlParts = url.parse(next, true)
            syncPosition.next = `${apiEndpoint}${urlParts.search}`
        } else {
            syncPosition.status = SyncStatus.STOPPED
            // @todo: configure so that the next update knows where to start from
            syncPosition.next = undefined
        }

        const results = this.buildResults(pageResults.data)

        if (!syncPosition.pos && syncPosition.mode == SyncHandlerMode.SNAPSHOT && results.length) {
            // Set the position of where the first set of updates should occur, once the snapshot is completed
            syncPosition.pos = pageResults.paging.cursors.before
        }

        return {
            results,
            position: syncPosition
        }
    }

    public async syncUpdate(Fb: typeof Facebook, syncPosition: SyncSchemaPosition): Promise<SyncResponse> {
        const apiEndpoint = '/me/likes'

        let uri = `${apiEndpoint}?limit=${this.config.followingLimit}`
        if (syncPosition.pos) {
            uri += `&before=${syncPosition.pos}`
        }
        
        const pageResults = await Fb.api(uri)

        if (!pageResults || !pageResults.data.length) {
            // No results
            syncPosition.status = SyncStatus.STOPPED
            return {
                position: syncPosition,
                results: []
            }
        }

        if (syncPosition.pos != pageResults.paging.cursors.before) {
            syncPosition.pos = pageResults.paging.cursors.before
        }

        const results = this.buildResults(pageResults.data)

        return {
            results,
            position: syncPosition
        }
    }

    protected buildResults(pageResults: any): SchemaFollowing[] {
        const results = []
        for (var r in pageResults) {
            const like = pageResults[r]
            const uriName = like.name.replace(/ /g, '-')
            const followedTimestamp = like.created_time

            results.push({
                _id: `facebook-${like.id}`,
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