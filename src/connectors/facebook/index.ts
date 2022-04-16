import { Request, Response } from 'express'
import BaseConnector from "../baseConnector"
const passport = require("passport")
const FacebookStrategy = require("passport-facebook")

const {Facebook, FacebookApiException} = require('fb')
const _ = require('lodash')
import url from 'url'
import { connect } from 'http2'

export interface ConfigInterface {
    appId: string
    appSecret: string
    callbackUrl: string
    limitResults: boolean
}

export default class FacebookConnector extends BaseConnector {

    protected config: ConfigInterface

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init()

        const auth = await passport.authenticate('facebook', {
            scope: ['email', 'user_likes', 'user_age_range', 'user_birthday', 'user_friends', 'user_gender', 'user_hometown', 'user_link', 'user_location', 'user_photos', 'user_posts', 'user_videos']
        })
        
        return auth(req, res, next)
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        this.init()

        const promise = new Promise((resolve, rejects) => {
            const auth = passport.authenticate('facebook', {
                failureRedirect: '/failure/facebook',
                failureMessage: true
            }, function(err: any, data: any) {
                if (err) {
                    rejects(err)
                } else {
                    const connectionToken = {
                        id: data.profile.id,
                        provider: data.profile.provider,
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        profile: data.profile
                    }
    
                    resolve(connectionToken)
                }
            })

            auth(req, res, next)
        })

        const result = await promise
        return result
    }

    public async sync(req: Request, res: Response, next: any): Promise<any> {
        const query = req.query
        const Fb = new Facebook({
            appId: this.config.appId,
            appSecret: this.config.appSecret
        })

        Fb.setAccessToken(query.accessToken)
        
        const likes = await this.getAllPages(Fb, '/me/likes')
        /*const posts = await FacebookConnector.getAllPages(Fb, '/me/posts')*/

        const likesProcessed = []
        for (var l in likes) {
            const like: any = likes[l]
            const uriName = like.name.replace(/ /g, '-')
            const followedTimestamp = like.created_time

            likesProcessed.push({
                _id: `facebook-${like.id}`,
                name: like.name,
                uri: `https://facebook.com/${uriName}-${like.id}`,
                sourceApplication: 'https://facebook.com/',
                sourceId: like.id,
                followedTimestamp
            })
        }

        return {
            'https://common.schemas.verida.io/social/following/v0.1.0/schema.json': likesProcessed
        }
    }

    public schemaUris(): string[] {
        return [
            'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'
        ]
    }

    /**
     * Helper method to fetch all the pages of data for any Facebook API endpoint
     */
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
    }

    public init() {
        passport.use(new FacebookStrategy({
            clientID: this.config.appId,
            clientSecret: this.config.appSecret,
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

