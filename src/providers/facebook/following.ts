import BaseSyncHandler from "../BaseSyncHandler"
const { Facebook } = require('fb')

import url from 'url'
import TokenExpiredError from "../TokenExpiredError"
import { SyncHandlerMode, SyncSchemaPosition, SyncStatus } from "../../interfaces"
const _ = require('lodash')

export default class Following extends BaseSyncHandler {

    public getSchemaUri(): string {
        return 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'
    }

    public async syncSnapshot(Fb: typeof Facebook, syncPosition: SyncSchemaPosition): Promise<object[]> {
        console.log('syncSnapshot()')
        const apiEndpoint = '/me/likes'

        if (!syncPosition.next) {
            console.log('dont have a next URI, so building it')
            syncPosition.next = `${apiEndpoint}?limit=${this.config.followingLimit}`
        }

        const pageResults = await Fb.api(syncPosition.next)

        if (!syncPosition.pos && syncPosition.mode == SyncHandlerMode.SNAPSHOT) {
            // Set the position of where the first set of updates should occur, once the snapshot is completed
            syncPosition.pos = pageResults.paging.cursors.before
        }

        if (_.has(pageResults, 'paging.next') && !this.config.limitResults) {
            // Have more results, so set the next page ready for the next request
            const next = pageResults.paging.next
            const urlParts = url.parse(next, true)
            syncPosition.next = `${apiEndpoint}${urlParts.search}`
        } else {
            syncPosition.status = SyncStatus.STOPPED
            // @todo: configure so that the next update knows where to start from
            syncPosition.next = undefined
        }

        console.log(syncPosition)
        return this.buildResults(pageResults.data)
    }

    public async syncUpdate(Fb: typeof Facebook, syncPosition: SyncSchemaPosition): Promise<object[]> {
        console.log('syncUpdate()')
        const apiEndpoint = '/me/likes'

        const uri = `${apiEndpoint}?limit=${this.config.followingLimit}&before${syncPosition.pos}`
        const pageResults = await Fb.api(uri)

        if (syncPosition.pos != pageResults.paging.cursors.before) {
            syncPosition.pos = pageResults.paging.cursors.before
        }

        return this.buildResults(pageResults.data)
    }

    protected buildResults(pageResults: any) {
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
                followedTimestamp,
                insertedAt: followedTimestamp
            })
        }

        console.log('results: ', results.length)
        return results
    }

}