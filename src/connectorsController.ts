import { Request, Response } from 'express'

import { Client, EnvironmentType, ContextInterfaces } from '@verida/client-ts'
import { AutoAccount } from '@verida/account-node'
import EncryptionUtils from '@verida/encryption-utils'

const VERIDA_ENVIRONMENT = EnvironmentType.TESTNET
const CONTEXT_NAME = 'Verida: Data Connector'
const PRIVATE_KEY = ''
const DATABASE_SERVER = 'https://db.testnet.verida.io:5002/'
const MESSAGE_SERVER = 'https://db.testnet.verida.io:5002/'
const DEFAULT_ENDPOINTS = {
    defaultDatabaseServer: {
        type: 'VeridaDatabase',
        endpointUri: 'https://db.testnet.verida.io:5002/'
    },
    defaultMessageServer: {
        type: 'VeridaMessage',
        endpointUri: 'https://db.testnet.verida.io:5002/'
    },
}

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = "debug"

import Connectors from "./connectors"

export default class ConnectorsController {


    /**
     * Initiate an auth connection for a given connector.
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    public static async connect(req: Request, res: Response, next: any) {
        const connector = Connectors(req.params.connector)
        return connector.connect(req, res, next)
    }

    /**
     * Facilitate an auth callback for a given connector.
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    public static async callback(req: Request, res: Response, next: any) {
        const connector = Connectors(req.params.connector)
        return connector.callback(req, res, next)
    }

    /**
     * Syncronize data from a third party data source with a local collection of datatores.
     * 
     * Converts the third party into an appropriate Verida schema.
     * 
     * Once this is complete, the Vault will then sync the data over the Verida network and
     * call `syncDone`
     * 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    public static async sync(req: Request, res: Response, next: any) {
        const connector = Connectors(req.params.connector)
        const data = await connector.sync(req, res, next)

        const { account, context } = await ConnectorsController.getNetwork()
        const signerDid = await account.did()

        const query = req.query
        const nonce = query.nonce.toString()
        const did = query.did.toString()

        const response: any = {}
        const databases = []

        for (var schemaUri in data) {
            const databaseName = EncryptionUtils.hash(`${did}-${schemaUri}-${nonce}`)

            const datastore = await context.openDatastore(schemaUri, {
                permissions: {
                    read: ContextInterfaces.PermissionOptionsEnum.USERS,
                    write: ContextInterfaces.PermissionOptionsEnum.USERS,
                    readList: [did],
                    writeList: [did]
                },
                databaseName
            })

            // Get database info so we can retreive the encryption key used
            const db = await datastore.getDb()
            let info = await db.info()

            try {
                for (var i in data[schemaUri]) {
                    const record = data[schemaUri][i]
                    console.log(record)
                    try {
                        if (record._id) {
                            // Since we manually set the `_id`, we need to manually set `insertedAt` because
                            // the database library will assume the record is an update
                            record.insertedAt = new Date().toISOString()
                        }

                        await datastore.save(record)
                    } catch (err) {
                        // ignore conflict errors (ie; document already existed)
                        if (err.status == 409) {
                            continue
                        }

                        // unknown error, throw
                        throw err
                    }
                }

                const encryptionKey = Buffer.from(info.encryptionKey).toString('hex')

                // Return the databaseName and encryptionKey so the vault can connect
                // and decrypt the data
                response[schemaUri] = {
                    databaseName,
                    encryptionKey
                }
            } catch (err) {
                // @todo: log these errors properly
                console.log(err.status, err.name)
                console.log(err)
            }
        }

        // Return the signerDid and contextName so the Vault can locate the correct
        // Storage node to access
        return res.send({
            did,
            response,
            signerDid,
            contextName: CONTEXT_NAME
        })
    }

    /**
     * The Vault has completed syncronizing data over the Verida network.
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
        const connector = Connectors(req.params.connector)
        const schemaUris = connector.schemaUris()

        const query = req.query
        const nonce = query.nonce.toString()
        const did: string = query.did.toString()

        const { context } = await ConnectorsController.getNetwork()

        const clearedDatabases = []
        for (let i in schemaUris) {
            const schemaUri = schemaUris[i]
            const databaseName = EncryptionUtils.hash(`${did}-${schemaUri}-${nonce}`)
            const datastore = await context.openDatastore(schemaUri, {
                permissions: {
                    read: ContextInterfaces.PermissionOptionsEnum.USERS,
                    write: ContextInterfaces.PermissionOptionsEnum.USERS,
                    readList: [did],
                    writeList: [did]
                },
                databaseName
            })

            const db = await datastore.getDb()

            try {
                // @todo: use `db.destroy()` once its released
                const d1 = await db._localDb.destroy()
                clearedDatabases.push(schemaUri)
            } catch (err) {
                console.log('error!')
                console.log(err)
            }
        }

        return res.send({
            clearedDatabases
        })
    }

    /**
     * Get a network, context and account instance
     * 
     * @returns 
     */
    public static async getNetwork(): Promise<any> {
        const network = new Client({
            environment: VERIDA_ENVIRONMENT
        })
        const account = new AutoAccount(DEFAULT_ENDPOINTS, {
            privateKey: PRIVATE_KEY,
            environment: VERIDA_ENVIRONMENT
        })
        await network.connect(account)
        const context = await network.openContext(CONTEXT_NAME)

        return {
            network,
            context,
            account
        }
    }

}