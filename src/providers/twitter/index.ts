import { Request, Response } from 'express'
import Base from "../BaseProvider"
import BaseProviderConfig from '../BaseProviderConfig'

const passport = require("passport")
const TwitterStrategy = require("passport-twitter-oauth2.0")
import { TwitterApi as TwitterClient } from 'twitter-api-v2'
import dayjs from 'dayjs'

import Following from './following'
import Posts from './posts'
import TokenExpiredError from '../TokenExpiredError'

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

    public getProviderId() {
        return 'twitter'
    }

    public syncHandlers(): any[] {
        return [
            Following,
            Posts
        ]
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init()
        const auth = await passport.authenticate(this.getProviderId())
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
            const auth = passport.authenticate(this.getProviderId(), {
                scope: SCOPE,
                failureRedirect: '/failure/twitter',
                failureMessage: true
            }, function(err: any, data: any) {
                if (err) {
                    rejects(err)
                } else {
                    const connectionToken = {
                        id: data.profile.id,
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

    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        let me, client

        try {
            client = new TwitterClient(accessToken)

            // check client works okay
            me = await client.v2.me({
                'user.fields': ['username', 'name', 'profile_image_url', 'created_at', 'url', 'description']
            })
        } catch (err: any) {
            // Auth error, attempt to obtain new refresh token
            if (err.code && (err.code == 401 || err.code == 403)) {
                try {
                    client = new TwitterClient({
                        clientId: this.config.clientID,
                        clientSecret: this.config.clientSecret
                    });
        
                    const {
                        client: refreshedClient,
                        accessToken: newAccessToken,
                        refreshToken: newRefreshToken
                    } = await client.refreshOAuth2Token(refreshToken);

                    this.setAccountAuth(newAccessToken, newRefreshToken)
                    client = refreshedClient

                    me = await client.v2.me({
                        'user.fields': ['username', 'name', 'profile_image_url', 'created_at', 'url', 'description']
                    })
                } catch (err) {
                    // Unrecoverable auth error
                    throw new TokenExpiredError(err.message)
                }
            } else {
                throw err
            }
        }

        const createdAt = dayjs(me.data.created_at).toISOString()

        this.profile = {
            id: me.data.id,
            name: me.data.name,
            username: me.data.username,
            description: me.data.description,
            url: me.data.url,
            avatarUrl: me.data.profile_image_url,
            createdAt
        }

        return client
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

