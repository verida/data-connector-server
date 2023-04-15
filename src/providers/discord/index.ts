import { Request, Response } from 'express'
import Base from "../BaseProvider"
import BaseProviderConfig from '../BaseProviderConfig'

const passport = require("passport")
import { Strategy as DiscordStrategy, Scope } from '@oauth-everything/passport-discord';
import { REST } from 'discord.js'
import { DiscordSnowflake } from '@sapphire/snowflake'
import dayjs from 'dayjs'
import axios from 'axios'

//import Following from './following'
//import Posts from './posts'
import TokenExpiredError from '../TokenExpiredError'

export interface DiscordProviderConfig extends BaseProviderConfig {
    clientID: string
    clientSecret: string
    callbackUrl: string
    limitResults: boolean
}

// Note: If scopes change a user needs to disconnect and reconnect the app
const SCOPE = [Scope.IDENTIFY, Scope.EMAIL, Scope.GUILDS, Scope.GUILDS_JOIN]

export default class DiscordProvider extends Base {

    protected config: DiscordProviderConfig

    public getProviderId() {
        return 'discord'
    }

    public getProviderLabel() {
        return 'Discord'
    }

    public syncHandlers(): any[] {
        /*return [
            Following,
            Posts
        ]*/
        return []
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        console.log('connect')
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
                failureRedirect: '/failure/discord',
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
        let me: any, client: REST

        try {
            client = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(accessToken);
            me = await client.get('/users/@me')
        } catch (err: any) {
            if (err.status && (err.status == 401 || err.status == 403)) {
                console.log('token has expired, fetch a new one')

                try {
                    const requestData = {
                        client_id: this.config.clientID,
                        client_secret: this.config.clientSecret,
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken
                    }
                    const newTokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', requestData, {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    const { access_token, refresh_token } = newTokenResponse.data
                    this.setAccountAuth(access_token, refresh_token)

                    client = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(access_token);
                    me = await client.get('/users/@me')
                } catch (err) {
                    // Unrecoverable auth error
                    throw new TokenExpiredError(err.message)
                }
            } else {
                throw err
            }
        }

        // ID's are based on timestamp of creation
        // @see https://github.com/discordjs/discord.js/blob/384b4d10e8642f0f280ea1651f33cd378c341333/packages/discord.js/src/structures/User.js#L130
        const createdTimestamp = DiscordSnowflake.timestampFrom(me.id)
        const createdAt = dayjs(createdTimestamp).toISOString()

        // Note: Discord doesn't have the concept of a profile `url` or `description`
        this.profile = {
            id: me.id,
            name: me.display_name ? me.display_name : me.username,
            username: me.username,
            // use user custom avatar if set, otherwise use default discord avatar
            avatarUrl: me.avatar ? client.cdn.avatar(me.id, me.avatar) : client.cdn.defaultAvatar(me.discriminator % 5),
            createdAt
        }

        return client
    }

    public init() {
        // obtain a new access token from refresh token
        passport.use(new DiscordStrategy({
            clientID: this.config.clientID,
            clientSecret: this.config.clientSecret,
            callbackURL: this.config.callbackUrl,
            scope: SCOPE,
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

