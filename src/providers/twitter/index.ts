import { Request, Response } from 'express'
import Base from "../baseProvider"
const passport = require("passport")
const TwitterStrategy = require("passport-twitter")
import { TwitterClient } from 'twitter-api-client'

const log4js = require("log4js")
const logger = log4js.getLogger()

const _ = require('lodash')
import dayjs from 'dayjs'

export interface ConfigInterface {
    apiKey: string
    apiSecret: string
    bearerToken: string
    callbackUrl: string
    limitResults: boolean
}

export default class TwitterProvider extends Base {

    protected config: ConfigInterface

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init()

        const auth = await passport.authenticate('twitter')
        
        return auth(req, res, next)
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        this.init()

        const promise = new Promise((resolve, rejects) => {
            const auth = passport.authenticate('twitter', {
                failureRedirect: '/failure/twitter',
                failureMessage: true
            }, function(err: any, data: any) {
                if (err) {
                    rejects(err)
                } else {
                    console.log(data)
                    /*const connectionToken = {
                        id: data.profile.id,
                        provider: data.profile.provider,
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        profile: data.profile
                    }*/
    
                    resolve(data)
                }
            })

            auth(req, res, next)
        })

        const result = await promise
        return result
    }

    public async sync(req: Request, res: Response, next: any): Promise<any> {
        const query = req.query
        const client = new TwitterClient({
            apiKey: this.config.apiKey,
            apiSecret: this.config.apiSecret,
            accessToken: query.accessToken.toString(),
            accessTokenSecret: query.refreshToken.toString()
        })
        
        // note this can return 5000 ids at a time
        const data = await client.accountsAndUsers.friendsIds()

        // for now, just fetch 10
        const ids = data.ids.slice(0, 20)

        // note: this method only supports 100 at a time
        const users = await client.accountsAndUsers.usersLookup({
            user_id: ids.join(',')
        })

        logger.debug(`Found ${users.length} twitter users`)
        const finalUsers = []
        for (let u in users) {
            const user: any = users[u]
            const createdAt = dayjs(user.created_at).toISOString()

            finalUsers.push({
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

        return {
            'https://common.schemas.verida.io/social/following/v0.1.0/schema.json': finalUsers
        }

    }

    public schemaUris(): string[] {
        return [
            'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'
        ]
    }

    /**
     * Helper method to fetch all the pages of data for any Facebook API endpoint
     *
    public async getAllPages(Fb: any, apiEndpoint: string, nextUrl: string = null, results: object[] = []): Promise<object[]> {
        if (!nextUrl) {
            nextUrl = `${apiEndpoint}?limit=5`
        }

        const pageResults = await Fb.api(nextUrl)
        results = results.concat(pageResults.data)

        if (_.has(pageResults, 'paging.next') && !this.config.limitResults) {
            const next = pageResults.paging.next
            const urlParts = url.parse(next, true)
            return await this.getAllPages(Fb, apiEndpoint, `${apiEndpoint}${urlParts.search}`, results)
        }

        return results
    }*/

    public init() {
        passport.use(new TwitterStrategy({
            consumerKey: this.config.apiKey,
            consumerSecret: this.config.apiSecret,
            callbackURL: this.config.callbackUrl
          },
          function(accessToken: string, refreshToken: string, profile: any, cb: any) {
            // Simply return the raw data
            return cb(null, {
                accessToken,
                refreshToken,
                profile
            })
          }
        ));
    }

}

