import BaseSyncHandler from "../BaseSyncHandler"
import CONFIG from '../../config'
const { Facebook } = require('fb')

import dayjs from 'dayjs'
import { SyncSchemaPosition, SyncResponse, SyncStatus, SyncHandlerMode } from "../../interfaces"
import { SchemaPost } from "../../schemas"
import { capitalizeFirstLetter } from "../../helpers"
import Axios from "axios"
const _ = require('lodash')

const log4js = require("log4js")
const logger = log4js.getLogger()

export default class Posts extends BaseSyncHandler {

    protected static schemaUri: string = CONFIG.verida.schemas.POST

    /**
     * @todo: Support paging through all results
     * @todo: Correctly support `this.config.limitResults`
     * 
     * @param api 
     */
    public async syncSnapshot(Fb: typeof Facebook, syncPosition: SyncSchemaPosition): Promise<SyncResponse> {
        const me = await Fb.api('/me?fields=picture')
        const pictureUrl = me.picture.data.url

        const apiEndpoint = '/me/posts'
        let uri = `${apiEndpoint}?fields=id,created_time,message,type,permalink_url&limit=${this.config.postLimit}`

        let pageResults
        if (syncPosition.next) {
            uri = `${syncPosition.next}&limit=${this.config.postLimit}`
            console.log('- Axios fetch')
            const axiosResult = await Axios.get(uri)
            pageResults = axiosResult.data
        } else {
            console.log('- API fetch')
            pageResults = await Fb.api(uri)
        }

        if (!pageResults || !pageResults.data.length) {
            syncPosition = this.resultsFinished(syncPosition, pageResults)

            return {
                position: syncPosition,
                results: []
            }
        }

        const results = this.buildResults(pageResults.data, pictureUrl, syncPosition.id ? syncPosition.id : undefined)
        syncPosition = this.setPosition(syncPosition, pageResults)

        if (results.length != this.config.postLimit) {
            // Not a full page of results, so stop processing
            syncPosition = this.resultsFinished(syncPosition, pageResults)
        }

        return {
            results,
            position: syncPosition
        }
    }

    public async syncUpdate(Fb: typeof Facebook, syncPosition: SyncSchemaPosition): Promise<SyncResponse> {
        return this.syncSnapshot(Fb, syncPosition)
    }

    protected resultsFinished(syncPosition: SyncSchemaPosition, serverResponse: any): SyncSchemaPosition {
        if (syncPosition.mode == SyncHandlerMode.UPDATE) {
            // Set the next ID to be the placeholder position
            syncPosition.id = syncPosition.pos
            syncPosition.pos = undefined
        }

        // No results
        syncPosition.status = SyncStatus.STOPPED
        syncPosition.mode = SyncHandlerMode.UPDATE

        return syncPosition
    }

    protected setSnapshotPosition(syncPosition: SyncSchemaPosition, serverResponse: any): SyncSchemaPosition {
        if (serverResponse.paging.next) {
            // We have a next page of results, so set that for the next page
            syncPosition.next = serverResponse.paging.next
        } else {
            // No next page of results, so clear the current value
            syncPosition.next = undefined
        }

        if (!syncPosition.id && serverResponse.data.length) {
            // No sync ID for updates, so set to the most recent
            syncPosition.id = serverResponse.data[0].id
        }

        return syncPosition
    }

    protected setUpdatePosition(syncPosition: SyncSchemaPosition, serverResponse: any): SyncSchemaPosition {
        if (!syncPosition.id && serverResponse.data.length) {
            // No sync ID for updates, so set to the most recent
            syncPosition.id = serverResponse.data[0].id
        }

        if (!syncPosition.pos && serverResponse.data.length) {
            // No next sync position, so set to the most recent
            syncPosition.pos = serverResponse.data[0].id
        }

        return syncPosition
    }

    protected buildResults(posts: any, pictureUrl: string, breakId: string): SchemaPost[] {
        const results = []
        for (let p in posts) {
            const post: any = posts[p]

            if (`facebook-${post.id}` == breakId) {
                // Break if the ID matches the record we are breaking on
                break
            }
            
            const createdAt = dayjs(post.created_time).toISOString()
            const icon = pictureUrl

            const sourceData = post

            // Strip new lines from the name
            const name = post.message ?
                post.message.replace(/\n\r|\r|\n/g, ' ').substring(0,100) :
                `Untitled Facebook ${capitalizeFirstLetter(post.type)}`

            results.push({
                _id: `facebook-${post.id}`,
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