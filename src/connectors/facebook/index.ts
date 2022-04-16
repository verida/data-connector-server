import { profile } from 'console'
import { Request, Response } from 'express'
import ConnectorInterface from "../connectorInterface"
const passport = require("passport")
const FacebookStrategy = require("passport-facebook")

const {Facebook, FacebookApiException} = require('fb')
const _ = require('lodash')
import url from 'url'

const FACEBOOK_APP_ID = ''
const FACEBOOK_APP_SECRET = ''
const CALLBACK_URL = 'http://localhost:5021/callback/facebook'


export default class FacebookConnector implements ConnectorInterface {

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        console.log('Facebook connect()')
        FacebookConnector.init()

        const auth = await passport.authenticate('facebook', {
            scope: ['email', 'user_likes', 'user_age_range', 'user_birthday', 'user_friends', 'user_gender', 'user_hometown', 'user_link', 'user_location', 'user_photos', 'user_posts', 'user_videos']
        })

        return auth(req, res, next)
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        console.log('Facebook callback()')
        FacebookConnector.init()

        const auth = await passport.authenticate('facebook', {
            failureRedirect: '/failure/facebook',
            failureMessage: true
        }, function(err: any, data: any) {
            if (err) {
                // @todo: make pretty error
                return res.send(`Error! ${err.name}`)
            } else {
                const connectionToken = {
                    id: data.profile.id,
                    provider: data.profile.provider,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    profile: data.profile
                }

                //console.log('sending data', data)
                //return res.send(connectionToken)
                //const redirectUrl = `veridavault://connector-auth-complete?connector=facebook&accessToken=${connectionToken.accessToken}`
                //const redirectUrl = `/sync/facebook?accessToken=${connectionToken.accessToken}`
                //console.log(`redirecting to ${redirectUrl}`)
                //return res.redirect(redirectUrl)

                //const redirectUrl = `veridavault://connector-auth-complete?connector=facebook&accessToken=${connectionToken.accessToken}`
                const redirectUrl = `https://vault.verida.io/inbox?page=connector-auth-complete&connector=facebook&accessToken=${connectionToken.accessToken}`
                const output = `<html>
                <head></head>
                <body>
                <a href="${redirectUrl}">Click me</a> (doesn't work as deep linking needs to be fixed)
                Access token: ${connectionToken.accessToken}
                </body>
                </html>`
                
                res.send(output)
            }
        })

        auth(req, res, next)
    }

    public async sync(req: Request, res: Response, next: any): Promise<any> {
        const query = req.query
        const Fb = new Facebook({
            appId: FACEBOOK_APP_ID,
            appSecret: FACEBOOK_APP_SECRET
        })

        Fb.setAccessToken(query.accessToken)
        
        const likes = await FacebookConnector.getAllPages(Fb, '/me/likes')
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
    static async getAllPages(Fb: any, apiEndpoint: string, nextUrl: string = null, results: object[] = []): Promise<object[]> {
        if (!nextUrl) {
            nextUrl = `${apiEndpoint}?limit=5`
        }

        const pageResults = await Fb.api(nextUrl)
        results = results.concat(pageResults.data)

        if (_.has(pageResults, 'paging.next') && false) {
            const next = pageResults.paging.next
            const urlParts = url.parse(next, true)
            return await FacebookConnector.getAllPages(Fb, apiEndpoint, `${apiEndpoint}${urlParts.search}`, results)
        }

        return results
    }

    static init() {
        passport.use(new FacebookStrategy({
            clientID: FACEBOOK_APP_ID,
            clientSecret: FACEBOOK_APP_SECRET,
            callbackURL: CALLBACK_URL
          },
          function(accessToken: string, refreshToken: string, profile: any, cb: any) {
            // Simply return the raw data
            return cb(null, {
                accessToken,
                refreshToken,
                profile
            })
            /*User.findOrCreate({ facebookId: profile.id }, function (err, user) {
              return cb(err, user);
            });*/
          }
        ));
    }

}

