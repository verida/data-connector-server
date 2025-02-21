import { Request, Response } from 'express'
import Providers from "../providers"
import SyncManager from '../sync-manager'
import { UniqueRequest } from '../interfaces'
import { NetworkConnection, Utils } from '../utils'
import { ContextSession } from '@verida/types'

const log4js = require("log4js")
const logger = log4js.getLogger()

/**
 * Sign in process:
 *
 * - Vault opens `connect` via safari
 * - User signs in
 * - Safari redirects to `callback`
 * - `callback` saves profile information in a datastore (DATA_PROFILE_SCHEMA) owned by this server, but readable by the user
 * - User is shown a deeplink which includes connection credentials (access, refresh token)
 * - User clicks deeplink to open Vault
 * - Vault fetches connection and profile information from the DATA_PROFILE_SCHEMA datastore
 *
 * Data sync process:
 *
 * - ..
 */
export default class Controller {

    /**
     * Initiate an auth connection for a given provider.
     *
     * @param req
     * @param res
     * @param next
     * @returns
     */
    public static async connect(req: Request, res: Response, next: any) {
        try {
            const providerName = req.params.providerId

            const contextSession: ContextSession | undefined = req.query['api_key'] ? JSON.parse(Buffer.from(req.query['api_key'].toString(), 'base64').toString('utf-8')) : undefined;

            const key = req.query.key ? req.query.key.toString() : undefined

            if (!key && !contextSession) {
                return res.status(400).send({
                    error: `Missing key or token in query parameters`
                });
            }

            const did = contextSession?.did || await Utils.getDidFromKey(key)

            let redirect = req.query.redirect ? req.query.redirect.toString() : ''
            // Session data isn't retained if using localhost, so use 127.0.0.1
            // @ts-ignore Session is injected as middleware
            req.session.redirect = redirect
            req.session.contextSession = contextSession
            req.session.key = key
            req.session.did = did

            const provider = Providers(providerName)

            const providerConfig = provider.getConfig()
            const status = providerConfig.status

            if (status !== 'active') {
                // Prevent connecting with a provider that is not active
                // Throw the same error as from Providers(providerName)
                throw new Error(`${providerName} not found`)
            }

            // TODO: Check the provider is enabled and the status is active

            await provider.connect(req, res, next)
        } catch (err: any) {
            const message = err.message
            // @todo: Generate nice looking thank you page
            const output = `<html>
            <head></head>
            <body>
                <div style="margin: auto; text-align: center;">
                    <h1>Error</h1>
                    <p>${message}</p>
                </div>
            </body>
            </html>`

            res.send(output)
        }
    }

    /**
     * Facilitate an auth callback for a given provider.
     *
     * Requires `did` in the query string
     *
     * @param req
     * @param res
     * @param next
     * @returns
     */
    public static async callback(req: UniqueRequest, res: Response, next: any) {
        try {
            logger.trace('callback()')
            const providerId = req.params.providerId
            const provider = Providers(providerId)

            const connectionResponse = await provider.callback(req, res, next)

            // TODO: Validate the express session object and remove the type assertions
            const key = req.session.key as string | undefined
            const contextSession = req.session.contextSession as ContextSession | undefined
            const redirect = req.session.redirect as string

            let networkConnection: NetworkConnection

            if (contextSession) {
                networkConnection = await Utils.getNetworkConnectionFromContextSession(contextSession, req.requestId)
            } else if (key) {
                networkConnection = await Utils.getNetworkConnectionFromPrivateKey(key, req.requestId)
            } else {
                throw new Error("No credentials provided")
            }

            const syncManager = new SyncManager(networkConnection.context)
            const connection = await syncManager.saveNewConnection(providerId, connectionResponse.accessToken, connectionResponse.refreshToken, connectionResponse.profile)

            // Start syncing (async so we don't block)
            syncManager.sync(providerId, connection.accountId)

            if (redirect) {
                const redirectedUrl = new URL(redirect)
                redirectedUrl.searchParams.append("connectionId", connection._id)
                res.redirect(redirectedUrl.toString())
            } else {
                const output = `<html>
                    <head>
                        <style>
                        button {
                            font-size: 30pt;
                            margin-top: 50px;
                        }
                        </style>
                    </head>
                    <body>
                        <div style="margin: auto; text-align: center;">
                            <h2>Success!</h2>
                        </div>
                        <div style="margin: auto; text-align: center;">
                            <img src="/assets/${providerId}/icon.png" style="width: 200px; height: 200px;" />
                        </div>
                        <div style="margin: auto; text-align: center;">
                            <p>You may close this window</p>
                        </div>
                    </body>
                    </html>`

                res.send(output)
            }
            // } else {


            //     // let redirectPath = 'https://vault.verida.io/connection-success'
            //     // if (redirect != 'deeplink') {
            //     //     redirectPath = redirect
            //     // }

            //     // Send the access token, refresh token and profile database name and encryption key
            //     // so the user can pull their profile remotely and store their tokens securely
            //     // This also avoids this server saving those credentials anywhere, they are only stored by the user
            //     //const redirectUrl = `${redirectPath}?provider=${providerName}&accessToken=${connectionResponse.accessToken}&refreshToken=${connectionResponse.refreshToken ? connectionResponse.refreshToken : ''}`


            //     // @todo: Generate nice looking thank you page
            //     const output = `<html>
            //     <head>
            //         <style>
            //         button {
            //             font-size: 30pt;
            //             margin-top: 50px;
            //         }
            //         </style>
            //     </head>
            //     <body>
            //         <div style="margin: auto; text-align: center;">
            //             <img src="/assets/${providerName}/icon.png" style="width: 200px; height: 200px;" />
            //         </div>
            //         <div style="margin: auto; text-align: center;">
            //             <button onclick="window.location.href='${redirectUrl}'">Complete Connection</a>
            //         </div>
            //     </body>
            //     </html>`

            //     res.send(output)
            // }

            // dont sync for now
            //await syncManager.sync(providerName)
        } catch (err: any) {
            console.log(err)
            const message = err.message
            // @todo: Generate nice looking thank you page
            const output = `<html>
            <head></head>
            <body>
                <div style="margin: auto; text-align: center;">
                    <h1>Error</h1>
                    <p>${message}</p>
                </div>
            </body>
            </html>`

            res.send(output)
        }

        // @todo: close context. syncManager.close() or utils.closeContext()?
    }

}
