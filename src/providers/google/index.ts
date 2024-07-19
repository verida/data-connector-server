import { Request, Response } from 'express'
import Base from "../BaseProvider"
import { BaseProviderConfig, SyncProviderLogLevel } from '../../interfaces'
import TokenExpiredError from '../TokenExpiredError'
import RequestLimitReachedError from '../RequestLimitReachedError'

const passport = require("passport")
const GoogleStrategy = require('passport-google-oauth20')

import Email from './email'

export interface GoogleProviderConfig extends BaseProviderConfig {
    clientId: string
    clientSecret: string
    callbackUrl: string
}

export default class GoogleProvider extends Base {

    protected config: GoogleProviderConfig

    public getProviderId() {
        return 'google'
    }

    public getProviderLabel() {
        return 'Google'
    }

    public getProviderApplicationUrl() {
        return 'https://google.com/'
    }

    public syncHandlers(): any[] {
        return [
            Email
        ]
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init()

        // e: "openid email profile https://mail.google.com/", access_type: "offline"}
        const auth = await passport.authenticate('google', {
            scope: ['profile', 'openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
            accessType: 'offline'
        })
        
        return auth(req, res, next)
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        this.init()

        const promise = new Promise((resolve, rejects) => {
            const auth = passport.authenticate('google', {
                failureRedirect: '/failure/google',
                failureMessage: true
            }, function(err: any, data: any) {
                if (err) {
                    rejects(err)
                } else {
                    console.log('callback!')
                    console.log(data)
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
        
    }

    public init() {
        console.log(this.config)
        passport.use(new GoogleStrategy({
            clientID: this.config.clientId,
            clientSecret: this.config.clientSecret,
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