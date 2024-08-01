import BaseSyncHandler from "../BaseSyncHandler"

import url from 'url'
import dayjs from 'dayjs'
const _ = require('lodash')

const log4js = require("log4js")
const logger = log4js.getLogger()

export default class Following extends BaseSyncHandler {

    protected static schemaUri: string = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

    public getName(): string {
        return 'following'
    }
    
    /**
     * @todo: Support paging through all results
     * @todo: Correctly support `this.config.limitResults`
     * 
     * @param api 
     */
    public async sync(api: any): Promise<any> {
        const me = await api.v2.me()

        const followingResult = await api.v2.following(me.data.id, {
            'user.fields': ['created_at', 'profile_image_url', 'description'],
            max_results: this.config.followingLimit
        })

        const users = followingResult.data

        const results = []
        for (let u in users) {
            const user: any = users[u]
            const createdAt = dayjs(user.created_at).toISOString()

            results.push({
                _id: `twitter-${user.id}`,
                name: user.name,
                icon: user.profile_image_url,
                summary: user.description.substring(0,100),
                uri: `https://twitter.com/${user.username}`,
                sourceApplication: 'https://twitter.com/',
                sourceId: user.id,
                followedTimestamp: createdAt,
                insertedAt: createdAt
            })
        }

        return results
    }

}