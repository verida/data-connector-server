import BaseSyncHandler from "../BaseSyncHandler"
import CONFIG from '../../config'
const { Facebook } = require('fb')

import dayjs from 'dayjs'
import { SyncHandlerPosition, SyncResponse, SyncHandlerStatus } from "../../interfaces"
import { SchemaPost } from "../../schemas"
import { capitalizeFirstLetter } from "../../helpers"
import Axios from "axios"
const _ = require('lodash')

const log4js = require("log4js")
const logger = log4js.getLogger()

export const enum PostSyncRefTypes {
    Url = "Url",
    Api = "Api"
}

export default class Posts extends BaseSyncHandler {

    public getName(): string {
        return 'post'
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.POST
    }

    /**
     * 
     * @param Fb 
     * @param syncPosition 
     * @returns SyncResponse
     */
    public async _sync(Fb: typeof Facebook, syncPosition: SyncHandlerPosition): Promise<SyncResponse> {
        const me = await Fb.api('/me?fields=picture')
        const pictureUrl = me.picture.data.url

        const apiEndpoint = '/me/posts'

        let pageResults
        if (syncPosition.thisRefType == PostSyncRefTypes.Url) {
            const url = `${syncPosition.thisRef}&limit=${this.config.postBatchSize}`
            const axiosResult = await Axios.get(url)
            pageResults = axiosResult.data
        } else {
            const url = `${apiEndpoint}?fields=id,created_time,message,type,permalink_url&limit=${this.config.postBatchSize}`
            pageResults = await Fb.api(url)
        }

        if (!pageResults || !pageResults.data.length) {
            // No results found, so stop sync
            syncPosition = this.stopSync(syncPosition, pageResults)

            return {
                position: syncPosition,
                results: []
            }
        }

        const results = this.buildResults(pageResults.data, pictureUrl, syncPosition.breakId ? syncPosition.breakId : undefined)
        syncPosition = this.setNextPosition(syncPosition, pageResults)

        if (results.length != this.config.postBatchSize) {
            // Not a full page of results, so stop sync
            syncPosition = this.stopSync(syncPosition, pageResults)
        }

        return {
            results,
            position: syncPosition
        }
    }

    protected stopSync(syncPosition: SyncHandlerPosition, serverResponse: any): SyncHandlerPosition {
        if (syncPosition.status == SyncHandlerStatus.STOPPED) {
            return syncPosition
        }
        
        if (syncPosition.futureBreakId) {
            syncPosition.thisRef = undefined
            syncPosition.breakId = syncPosition.futureBreakId
        }

        syncPosition.thisRefType = PostSyncRefTypes.Api
        syncPosition.status = SyncHandlerStatus.STOPPED
        syncPosition.futureBreakId = undefined
        return syncPosition
    }

    protected setNextPosition(syncPosition: SyncHandlerPosition, serverResponse: any): SyncHandlerPosition {
        if (_.has(serverResponse, 'paging.next')) {
            // We have a next page of results, so set that for the next page
            syncPosition.thisRef = serverResponse.paging.next
            syncPosition.thisRefType = PostSyncRefTypes.Url
        } else {
            // No next page of results, so clear the current value
            syncPosition.thisRef = undefined
            syncPosition.thisRefType = PostSyncRefTypes.Api
        }

        if (!syncPosition.futureBreakId && serverResponse.data.length) {
            // No future break ID for updates, so set to the most recent
            syncPosition.futureBreakId = serverResponse.data[0].id
        }

        return syncPosition
    }

    protected buildResults(posts: any, pictureUrl: string, breakId: string): SchemaPost[] {
        const results = []
        for (let p in posts) {
            const post: any = posts[p]

            if(post.id == breakId) {
                // Break if the ID matches the record we are breaking on
                break
            }
            
            const createdAt = post.created_time ? dayjs(post.created_time).toISOString() : new Date().toISOString()
            const icon = pictureUrl

            const sourceData = post

            // Strip new lines from the name
            const name = post.message ?
                post.message.replace(/\n\r|\r|\n/g, ' ').substring(0,100) :
                `Untitled Facebook ${capitalizeFirstLetter(post.type)}`

            results.push({
                _id: this.buildItemId(post.id),
                name: name,
                type: post.type,
                content: post.message ? post.message : '',
                contentHtml: post.message ? post.message : '',
                icon,
                summary: name,
                uri: post.permalink_url,
                sourceApplication: 'https://facebook.com/',
                sourceId: post.id,
                sourceData,
                insertedAt: createdAt
            })
        }

        return results
    }

}