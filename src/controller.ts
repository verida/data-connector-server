import { Request, Response } from 'express'
import { DatabasePermissionOptionsEnum } from '@verida/types'
import EncryptionUtils from '@verida/encryption-utils'
import serverconfig from '../src/serverconfig.json'

const CONTEXT_NAME = serverconfig.verida.contextName

const log4js = require("log4js")
const logger = log4js.getLogger()

//const DATA_CONNECTION_SCHEMA = 'https://vault.schemas.verida.io/data-connections/connection/v0.1.0/schema.json'
//const DATA_PROFILE_SCHEMA = 'https://vault.schemas.verida.io/data-connections/profile/v0.1.0/schema.json'
const DATA_SYNC_REQUEST_SCHEMA = 'https://vault.schemas.verida.io/data-connections/sync-request/v0.1.0/schema.json'

import Providers from "./providers"
import TokenExpiredError from './providers/TokenExpiredError'
import Utils from './utils'

const delay = async (ms: number) => {
    await new Promise((resolve) => setTimeout(() => resolve(true), ms))
}

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
 * - Vault triggers a sync (via user manually clicking or background process) and sets the data source status to "syncing"
 * - `sync` endpoint sends a HTTP response immediately and continues processing in the background
 * - `sync` endpoint fetches all the data from the data source and saves it into the datastores for the user
 * - Vault loops through all data sources (every app open, plus every 1 minute) to identify those that 
 * - Vault opens the datastores that have been updated by the connector server and pulls that data into the Vault
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
        const did = query.did.toString()
        const key = query.key.toString()

        // @ts-ignore Session is injected as middleware
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

        // @todo: handle error and show error message
        const connectionToken = await provider.callback(req, res, next)

        // @ts-ignore
        const did = req.session.did

        // Send the access token, refresh token and profile database name and encryption key
        // so the user can pull their profile remotely and store their tokens securely
        // This also avoids this server saving those credentials anywhere, they are only stored by the user
        const redirectUrl = `https://vault.verida.io/connection-success?provider=${providerName}&accessToken=${connectionToken.accessToken}&refreshToken=${connectionToken.refreshToken ? connectionToken.refreshToken : ''}`

        // @todo: Generate nice looking thank you page
        const output = `<html>
        <head></head>
        <body>
        <div style="margin: auto; font-size: 16px;">
            <a href="${redirectUrl}">Complete Connection</a>
        </div>
        </body>
        </html>`
        
        res.send(output)
    }

    /**
     * Synchronize data from a third party data source with a local collection of datatores.
     * 
     * Converts the third party into an appropriate Verida schema.
     * 
     * Once this is complete, the Vault will then sync the data over the Verida network and
     * call `syncDone`
     * 
     * Requires the following query parameters:
     * 
     * - did
     * - any other data required by the provider (ie: `accessToken`)
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    public static async sync(req: Request, res: Response, next: any) {
        const { account, context } = await Utils.getNetwork()
        const serverDid = await account.did()

        const providerName = req.params.provider
        const provider = Providers(providerName)

        const query = req.query
        const did = query.did.toString()
        const encryptionKey = Buffer.from(query.key.toString(), 'hex')

        // Generate a new sync request
        const syncRequestDatabaseName = EncryptionUtils.hash(`${did}-${DATA_SYNC_REQUEST_SCHEMA}`)
        const syncRequestDatastore = await context.openDatastore(DATA_SYNC_REQUEST_SCHEMA, {
            permissions: {
                read: DatabasePermissionOptionsEnum.USERS,
                write: DatabasePermissionOptionsEnum.USERS,
                readList: [did],
                writeList: [did]
            },
            databaseName: syncRequestDatabaseName,
            encryptionKey
        })
        
        const syncRequestResult = await syncRequestDatastore.save({
            source: providerName,
            requestStart: (new Date()).toISOString(),
            status: 'requested'
        })
        const syncRequest = await syncRequestDatastore.get(syncRequestResult.id)
        if (!syncRequest.syncInfo) {
            syncRequest.syncInfo = {}
        }

        res.send({
            did,
            serverDid,
            syncRequestId: syncRequest._id,
            syncRequestDatabaseName,
            contextName: CONTEXT_NAME
        })

        // Fetch the necessary data from the provider
        let data: any = {}
        try {
            data = await provider.syncFromRequest(req, res, next)
        } catch (err: any) {
            syncRequest.status = 'error'
            if (err instanceof TokenExpiredError) {
                syncRequest.syncInfo.error = `Token expired, please reconnect.`
            }
            else {
                syncRequest.syncInfo.error = err.message
            }

            await syncRequestDatastore.save(syncRequest)

            // Add a delay so the sync request has time to sync
            await delay(2000)

            await context.close({
                clearLocal: true
            })

            return
        }

        // Add account auth info if it has changed
        const newAuth = provider.getAccountAuth()
        if (newAuth) {
            syncRequest.syncInfo.newAuth = newAuth
        }

        // Add latest profile info
        syncRequest.syncInfo.profile = await provider.getProfile(did, context)

        const response: any = {}
        const syncingDatabases = []

        // iterate through the data and save it into the appropriate datastore
        // NOTE: database stores data for all providers, not just this one being processed
        for (var schemaUri in data) {
            const databaseName = EncryptionUtils.hash(`${did}-${schemaUri}`)

            // open a datastore where the user has permission to access the datastores
            const datastore = await context.openDatastore(schemaUri, {
                permissions: {
                    read: DatabasePermissionOptionsEnum.USERS,
                    write: DatabasePermissionOptionsEnum.USERS,
                    readList: [did],
                    writeList: [did]
                },
                databaseName
            })

            // Get database info so we can retrieve the encryption key used
            const db = await datastore.getDb()
            const info = await db.info()
            
            logger.info(`Inserting ${data[schemaUri].length} records into database: ${databaseName} (${info.databaseHash})`)

            try {
                for (var i in data[schemaUri]) {
                    const record = data[schemaUri][i]
                    logger.trace(`Inserting record:`, record)

                    try {
                        if (!record.insertedAt) {
                            // Since we manually set the `_id`, we need to manually set `insertedAt` because
                            // the database library will assume the record is an update
                            record.insertedAt = new Date().toISOString()
                        }

                        const result = await datastore.save(record, {
                            forceUpdate: false
                        })
                        if (!result) {
                            // Validation errors, how to log? Should only happen in dev
                            console.log(datastore.errors)
                            console.log(record)
                        }
                    } catch (err) {
                        // ignore conflict errors (ie; document already existed)
                        if (err.status == 409) {
                            logger.trace(`Conflict error inserting:`, record._id)
                            continue
                        }

                        // unknown error, throw
                        throw err
                    }
                }

                const encryptionKey = Buffer.from(info.encryptionKey).toString('hex')

                // Save the databaseName and encryptionKey so the vault can connect
                // and decrypt the data
                response[schemaUri] = {
                    databaseName,
                    encryptionKey
                }
            } catch (err) {
                logger.error(err.status, err.name)
            }

            syncingDatabases.push(db)
        }

        // There is a time delay from writing to local pouchdb to that syncing with
        // the encrypted database.
        //
        // This code loops through all the databases that were written to and 
        // checks the encrypted database has enough records written before flagging
        // it as being fully sync'd
        let count = 5
        while (count > 0) {
            let completeCount = 0
            for (let i = 0; i < syncingDatabases.length; i++) {
                const db = syncingDatabases[i]

                const remote = await db.getRemoteEncrypted()
                const local = await db.getDb()

                const remoteInfo = await remote.info()
                const localInfo = await local.info()

                if (remoteInfo.doc_count >= localInfo.doc_count) {
                    completeCount++
                }
            }

            if (completeCount == syncingDatabases.length) {
                // Update the sync request to say it has completed successfully
                syncRequest.syncInfo.schemas = response
        
                syncRequest.status = "complete"
                const res = await syncRequestDatastore.save(syncRequest)
                if (!res) {
                    console.log(`Errors saving sync request`)
                    console.log(syncRequestDatastore.errors)
                }
                
                logger.info(`Saved sync request indicating process is complete`)
                // Wait 3 seconds to be super sure sync response is saved to DB
                await delay(3000)

                await context.close({
                    clearLocal: true
                })

                return
            }

            await delay(2000)
            count--
        }

        // After 5x2 second delays, we still don't have sync so assume it has failed
        syncRequest.status = "error"
        syncRequest.syncInfo.error = "Server timed out syncing encrypted database"

        await syncRequestDatastore.save(syncRequest)
        
        logger.info(`Saved sync request indicating process has error`)

        await context.close({
            clearLocal: true
        })
    }

    /**
     * The Vault has completed synchronizing data over the Verida network.
     * 
     * This server can now destroy the local encrypted copy of data.
     * 
     * @todo In the future it may be possible to do this deletion as part of the sync process, since
     * the local data is never actually used, just the couchdb encrypted data.
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    public static async syncDone(req: Request, res: Response, next: any) {
        logger.trace(`syncDone()`)
        return res.send({
            success: true
        })
        const providerName = req.params.provider
        const provider = Providers(providerName)
        const schemaUris = provider.schemaUris()

        const query = req.query
        const did: string = query.did.toString()

        const { context } = await Utils.getNetwork()

        const clearedDatabases = []
        for (let i in schemaUris) {
            const schemaUri = schemaUris[i]
            const databaseName = EncryptionUtils.hash(`${did}-${schemaUri}`)
            const datastore = await context.openDatastore(schemaUri, {
                permissions: {
                    read: DatabasePermissionOptionsEnum.USERS,
                    write: DatabasePermissionOptionsEnum.USERS,
                    readList: [did],
                    writeList: [did]
                },
                databaseName
            })

            const db = await datastore.getDb()

            try {
                // @todo: use `db.destroy()` once its released
                await db._localDb.destroy()
                clearedDatabases.push(schemaUri)
            } catch (err) {
                logger.error(err.status, err.name)
            }
        }

        return res.send({
            clearedDatabases
        })
    }

}