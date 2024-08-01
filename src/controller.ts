import { Request, Response } from 'express'
import CONFIG from './config'

const log4js = require("log4js")
const logger = log4js.getLogger()

//const DATA_CONNECTION_SCHEMA = 'https://vault.schemas.verida.io/data-connections/connection/v0.1.0/schema.json'
//const DATA_PROFILE_SCHEMA = 'https://vault.schemas.verida.io/data-connections/profile/v0.1.0/schema.json'
const DATA_SYNC_REQUEST_SCHEMA = 'https://vault.schemas.verida.io/data-connections/sync-request/v0.1.0/schema.json'

import Providers from "./providers"
import SyncManager from './sync-manager'
import { HandlerOption } from './interfaces'

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
        logger.trace('connect()')
        const providerName = req.params.provider
        const query = req.query
        let redirect = query.redirect ? query.redirect.toString() : 'deeplink'
        const key = query.key ? query.key.toString() : undefined
        const did = query.did ? query.did.toString() : undefined

        if (key && did) {
            redirect = 'save'
        }

        // Session data isn't retained if using localhost, so use 127.0.0.1
        // @ts-ignore Session is injected as middleware
        req.session.redirect = redirect
        req.session.key = key
        req.session.did = did

        const provider = Providers(providerName)
        return provider.connect(req, res, next)
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
    public static async callback(req: Request, res: Response, next: any) {
        logger.trace('callback()')
        const providerName = req.params.provider
        const provider = Providers(providerName)

        try {
            const connectionResponse = await provider.callback(req, res, next)
    
            const did = req.session.did
            const key = req.session.key

            if (did && key) {
                const syncManager = new SyncManager(did, key)
                await syncManager.saveProvider(providerName, connectionResponse.accessToken, connectionResponse.refreshToken, connectionResponse.profile)

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
                            <img src="/assets/${providerName}/icon.png" style="width: 200px; height: 200px;" />
                        </div>
                        <div style="margin: auto; text-align: center;">
                            <p>You may close this window</p>
                        </div>
                    </body>
                    </html>`
                
                res.send(output)

                // dont sync for now
                //await syncManager.sync(providerName)
            } else {
                const redirect = req.session.redirect

                let redirectPath = 'https://vault.verida.io/connection-success'
                if (redirect != 'deeplink') {
                    redirectPath = redirect
                }

                // Send the access token, refresh token and profile database name and encryption key
                // so the user can pull their profile remotely and store their tokens securely
                // This also avoids this server saving those credentials anywhere, they are only stored by the user
                const redirectUrl = `${redirectPath}?provider=${providerName}&accessToken=${connectionResponse.accessToken}&refreshToken=${connectionResponse.refreshToken ? connectionResponse.refreshToken : ''}`

                // @todo: Generate nice looking thank you page
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
                        <img src="/assets/${providerName}/icon.png" style="width: 200px; height: 200px;" />
                    </div>
                    <div style="margin: auto; text-align: center;">
                        <button onclick="window.location.href='${redirectUrl}'">Complete Connection</a>
                    </div>
                </body>
                </html>`
                
                res.send(output)
            }
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

        // @todo: close context. syncManager.close() or utils.closeContext()?
    }

    /**
     * Initialize a syncronization for a `Verida: Vault` context
     * 
     * @param req 
     * @param res 
     * @param next 
     */
    public static async sync(req: Request, res: Response, next: any) {
        const query = req.query
        const did = query.did.toString()
        const vaultSeedPhrase = query.seed.toString()

        const syncManager = new SyncManager(did, vaultSeedPhrase)
        await syncManager.sync()

        // @todo: catch and send errors
        return res.send({
            success: true
        })
    }

    public static async providers(req: Request, res: Response) {
        const providers = Object.keys(CONFIG.providers)

        const results: any = {}
        for (let p in providers) {
            const providerName = providers[p]

            try {
                const provider = Providers(providerName)
                const syncHandlers = await provider.getSyncHandlers()
                const handlers: Record<string, HandlerOption[]> = {}
                for (const handler of syncHandlers) {
                    handlers[handler.getName()] = handler.getOptions()
                }

                results[providerName] = {
                    name: providerName,
                    label: provider.getProviderLabel(),
                    icon: provider.getProviderImageUrl(),
                    description: provider.getDescription(),
                    options: provider.getOptions(),
                    handlers
                }
            } catch (err) {
                // skip broken providers
            }
        }

        return res.send(results)
    }

}