import { Request, Response } from 'express'
import Base from "../BaseProvider"
import BaseProviderConfig from '../BaseProviderConfig'

const passport = require("passport")
const TwitterStrategy = require("passport-twitter-oauth2.0")
import { TwitterApi as TwitterClient } from 'twitter-api-v2'

import Following from './following'
import Posts from './posts'

export interface TwitterProviderConfig extends BaseProviderConfig {
    clientID: string
    clientSecret: string
    callbackUrl: string
    limitResults: boolean
}

// Note: If scopes change a user needs to disconnect and reconnect the app
const SCOPE = ['tweet.read', 'offline.access', 'users.read', 'follows.read']

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
                scope: SCOPE,
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
        try {
            const client = new TwitterClient(accessToken)

            // check client works okay
            await client.v2.me()
            return client
        } catch (err: any) {
            // Auth error, attempt to obtain new refresh token
            if (err.code && (err.code == 401 || err.code == 403)) {
                const client = new TwitterClient({
                    clientId: this.config.clientID,
                    clientSecret: this.config.clientSecret
                });
    
                const {
                    client: refreshedClient,
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken
                } = await client.refreshOAuth2Token(refreshToken);

                this.setAccountAuth(newAccessToken, newRefreshToken)
                return refreshedClient
            }

            throw err
        }
    }

    public init() {
        // obtain a new access token from refresh token
        passport.use(new TwitterStrategy({
            clientID: this.config.clientID,
            clientSecret: this.config.clientSecret,
            callbackURL: this.config.callbackUrl,
            clientType: 'private',
            scope: SCOPE,
            pkce: true, // required,
            state: true // required
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

