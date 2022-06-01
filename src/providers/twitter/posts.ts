import BaseSyncHandler from "../baseSyncHandler"

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
        const accountSettings = await api.accountsAndUsers.accountSettings()
        const screenName = accountSettings.screen_name

        // Maximum is 200 at a time.
        // May not return a full 200 as retweets and replies are counted in the total, but not returnred!
        const tweetsReturned = await api.tweets.statusesUserTimeline({
            screen_name: screenName,
            exclude_replies: true,
            include_rts: false,
        })

        const tweets = tweetsReturned.slice(0,this.config.postLimit)

        const results = []
        for (let t in tweets) {
            const tweet: any = tweets[t]
            
            const createdAt = dayjs(tweet.created_at).toISOString()
            const icon = tweet.user.profile_image_url_https

            const sourceData = tweet
            sourceData['user'] = {
                id: tweet.user.id,
                screen_name: tweet.user.screen_name
            }

            // Strip new lines from the name
            const name = tweet.text.replace(/\r\n|\r|\n/g, ' ').substring(0,100)

            results.push({
                _id: `twitter-${tweet.id_str}`,
                name: name,
                content: tweet.text,
                contentHtml: tweet.text,
                icon,
                summary: name,
                uri: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
                sourceApplication: 'https://twitter.com/',
                sourceId: tweet.id_str,
                sourceData,
                insertedAt: createdAt
            })
        }

        return results
    }

}