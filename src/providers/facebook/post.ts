import BaseSyncHandler from "../BaseSyncHandler"
import CONFIG from '../../config'

import dayjs from 'dayjs'
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
    public async sync(api: any): Promise<any> {
        const me = await api.api('/me?fields=picture')
        const pictureUrl = me.picture.data.url

        const responsePosts = await api.api('/me/posts?fields=id,created_time,message,type,permalink_url')
        const posts = responsePosts.data

        const results = []
        for (let p in posts) {
            const post: any = posts[p]
            if (post.type !== 'status' || !post.message) {
                continue
            }
            
            const createdAt = dayjs(post.created_time).toISOString()
            const icon = pictureUrl

            const sourceData = post

            // Strip new lines from the name
            const name = post.message.replace(/\n\r|\r|\n/g, ' ').substring(0,100)

            results.push({
                _id: `facebook-${post.id}`,
                name: name,
                content: post.message,
                contentHtml: post.message,
                icon,
                summary: name,
                uri: post.permalink_url,
                sourceApplication: 'https://facebook.com/',
                sourceId: post.id,
                sourceData,
                insertedAt: createdAt
            })
        }

        return results.slice(0, this.config.postLimit)
    }

}