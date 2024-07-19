import { Request, Response } from 'express'
import Base from "../BaseProvider"
import { BaseProviderConfig, SyncProviderLogLevel } from '../../interfaces'
import TokenExpiredError from '../TokenExpiredError'
import RequestLimitReachedError from '../RequestLimitReachedError'

const passport = require("passport")
const FacebookStrategy = require("passport-facebook")

const {Facebook, FacebookApiException} = require('fb')

import Following from './following'
import Post from './post'

export interface FacebookProviderConfig extends BaseProviderConfig {
    appId: string
    appSecret: string
    callbackUrl: string
    limitResults: boolean
}

export default class FacebookProvider extends Base {

    protected config: FacebookProviderConfig

    public getProviderId() {
        return 'facebook'
    }

    public getProviderLabel() {
        return 'Facebook'
    }

    public getProviderApplicationUrl() {
        return 'https://facebook.com/'
    }

    public syncHandlers(): any[] {
        return [
            Following,
            Post
        ]
    }

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
        const Fb = new Facebook({
            appId: this.config.appId,
            appSecret: this.config.appSecret
        })

        try {
            Fb.setAccessToken(accessToken)

            const me = await Fb.api('/me?fields=id,name,picture,link')

            this.profile = {
                id: me.id,
                name: me.name,
                url: me.link,
                avatarUrl: me.picture.data.url
            }

            return Fb
        } catch (err: any) {
            if (err.response && err.response.error.code == 190) {
                this.logMessage(SyncProviderLogLevel.INFO, 'Facebook token expired')
                throw new TokenExpiredError(err.response.error.message)
            } else if (err.message.match('request limit reached')) {
                this.logMessage(SyncProviderLogLevel.INFO, 'Facebook request limit reached')
                throw new RequestLimitReachedError(err.response.error.message)
            }

            throw err
        }
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

