import BaseSyncHandler from "../BaseSyncHandler"
const { Facebook } = require('fb')

import url from 'url'
import TokenExpiredError from "../TokenExpiredError"
const _ = require('lodash')

export default class Following extends BaseSyncHandler {

    protected static schemaUri: string = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

    public async sync(api: any): Promise<any> {
        const likes = await this.getAllPages(api, '/me/likes')
        /*const posts = await FacebookProvider.getAllPages(Fb, '/me/posts')*/
        
        const results = []
        for (var l in likes) {
            const like: any = likes[l]
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

        return results
    }

    /**
     * Helper method to fetch all the pages of data for any Facebook API endpoint
     */
     public async getAllPages(Fb: any, apiEndpoint: string, nextUrl: string = null, results: object[] = []): Promise<object[]> {
        if (!nextUrl) {
            nextUrl = `${apiEndpoint}?limit=${this.config.followingLimit}`
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