import BaseSyncHandler from "../BaseSyncHandler"

import dayjs from 'dayjs'
const _ = require('lodash')

const log4js = require("log4js")
const logger = log4js.getLogger()

export default class Posts extends BaseSyncHandler {

    protected static schemaUri: string = 'https://common.schemas.verida.io/social/post/v0.1.0/schema.json'

    /**
     * @todo: Support paging through all results
     * @todo: Correctly support `this.config.limitResults`
     * 
     * @param api 
     */
    public async sync(api: any): Promise<any> {
        // Get the current user's screen name
        const me = await api.v2.me()

        const timelinePaginator = await api.v2.userTimeline(me.data.id, {
            max_results: this.config.postLimit,
            exclude: ['replies', 'retweets']
        })

        const timeline = timelinePaginator.tweets

        const tweetIds = timeline.map((elm: any) => elm.id)
        const tweetResponse = await api.v2.tweets(tweetIds, {
            'expansions': ['author_id', 'geo.place_id'],
            'tweet.fields': ['created_at'],
            'user.fields': ['username', 'name', 'profile_image_url']
        })

        const tweets = tweetResponse.data
        const users = tweetResponse.includes.users.reduce((result: any, value: any) => {
            result[value.id] = value
            return result
        }, {})

        const results = []
        for (let t in tweets) {
            const tweet: any = tweets[t]
            const author: any = users[tweet.author_id]
            
            const createdAt = dayjs(tweet.created_at).toISOString()
            const icon = author.profile_image_url

            const sourceData = tweet
            sourceData['user'] = {
                id: tweet.author_id,
                screen_name: author.name,
                avatar: author.profile_image_url,
                url: `https://twitter.com/${author.name}/`
            }

            // Strip new lines from the name
            const name = tweet.text.replace(/\r\n|\r|\n/g, ' ').substring(0,100)

            results.push({
                _id: `twitter-${tweet.id}`,
                name: name,
                content: tweet.text,
                contentHtml: tweet.text,
                icon,
                summary: name,
                uri: `https://twitter.com/${author.name}/status/${tweet.id}`,
                sourceApplication: 'https://twitter.com/',
                sourceId: tweet.id,
                sourceData,
                insertedAt: createdAt
            })
        }

        return results
    }

}