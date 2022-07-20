import { Request, Response } from 'express'
import Base from "../BaseProvider"
import BaseProviderConfig from '../BaseProviderConfig'

const passport = require("passport")
const TwitterStrategy = require("passport-twitter")
import { TwitterClient } from 'twitter-api-client'

import Following from './following'
import Posts from './posts'

export interface TwitterProviderConfig extends BaseProviderConfig {
    apiKey: string
    apiSecret: string
    bearerToken: string
    callbackUrl: string
    limitResults: boolean
}

export default class TwitterProvider extends Base {

    protected config: TwitterProviderConfig

    public syncHandlers(): any[] {
        return [
            Following,
            Posts
        ]
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init()
        const auth = await passport.authenticate('twitter')
        return auth(req, res, next)
    }

    /**
     * @todo: Create proper connectionToken response
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
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

    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        const client = new TwitterClient({
            apiKey: this.config.apiKey,
            apiSecret: this.config.apiSecret,
            accessToken: accessToken,
            accessTokenSecret: refreshToken
        })

        return client
    }

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

