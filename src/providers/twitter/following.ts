import BaseSyncHandler from "../baseSyncHandler"

import url from 'url'
import dayjs from 'dayjs'
const _ = require('lodash')

const log4js = require("log4js")
const logger = log4js.getLogger()

export default class Following extends BaseSyncHandler {

    protected static schemaUri: string = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

    /**
     * @todo: Support paging through all results
     * @todo: Correctly support `this.config.limitResults`
     * 
     * @param api 
     */
    public async sync(api: any): Promise<any> {
        // note this can return 5000 ids at a time
        const data = await api.accountsAndUsers.friendsIds()

        // for now, just fetch 10
        const ids = data.ids.slice(0, 20)

        // note: this method only supports 100 at a time
        const users = await api.accountsAndUsers.usersLookup({
            user_id: ids.join(',')
        })

        logger.debug(`Found ${users.length} twitter users`)
        const results = []
        for (let u in users) {
            const user: any = users[u]
            const createdAt = dayjs(user.created_at).toISOString()

            results.push({
                _id: `twitter-${user.id_str}`,
                name: user.name,
                icon: user.profile_image_url_https,
                summary: user.description.substring(0,100),
                uri: `https://twitter.com/${user.screen_name}`,
                sourceApplication: 'https://twitter.com/',
                sourceId: user.id_str,
                followedTimestamp: createdAt,
                insertedAt: createdAt
            })
        }

        return results
    }

    /**
     * Helper method to fetch all the pages of data for any Facebook API endpoint
     */
     public async getAllPages(Fb: any, apiEndpoint: string, nextUrl: string = null, results: object[] = []): Promise<object[]> {
        if (!nextUrl) {
            nextUrl = `${apiEndpoint}?limit=${this.config.likeLimit}`
        }

        const pageResults = await Fb.api(nextUrl)
        results = results.concat(pageResults.data)

        if (_.has(pageResults, 'paging.next') && !this.config.limitResults) {
            const next = pageResults.paging.next
            const urlParts = url.parse(next, true)
            return await this.getAllPages(Fb, apiEndpoint, `${apiEndpoint}${urlParts.search}`, results)
        }

        return results
    }

}