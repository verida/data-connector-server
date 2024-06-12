import CONFIG from './config'
import { IContext, IDatastore } from "@verida/types";
import Providers from "./providers"
import { Connection, DatastoreSaveResponse, SyncSchemaConfig } from './interfaces';
import BaseProvider from './providers/BaseProvider';
import TokenExpiredError from './providers/TokenExpiredError';
import { Utils } from './utils';

const log4js = require("log4js")
const logger = log4js.getLogger()

const DATA_CONNECTION_SCHEMA =
    'https://vault.schemas.verida.io/data-connections/connection/v0.1.0/schema.json'
const DATA_SYNC_REQUEST_SCHEMA =
    'https://vault.schemas.verida.io/data-connections/sync-request/v0.1.0/schema.json'

const delay = async (ms: number) => {
    await new Promise((resolve: any) => setTimeout(() => resolve(), ms))
}

export default class SyncManager {

    private did: string
    private seedPhrase: string

    private connectionDatastore?: IDatastore

    public constructor(did: string, seedPhrase: string) {
        this.did = did
        this.seedPhrase = seedPhrase
    }

    public async sync() {
        const vault = await this.getVault()

        const providers = await this.getProviders(vault)
        // @todo: Do these in parallel?
        // May need a shared cache of datastore connections so we 
        // don't try to open the same one multiple times
        for (let p in providers) {
            const provider = providers[p]
            await this.syncProvider(vault, provider)
        }
    }

    public async getVault(): Promise<IContext> {
        // @todo: How to open a single context from a keyring seed phrase?
        try {
            const { context } = await Utils.getNetwork(this.did, this.seedPhrase)

            return <IContext> context
        } catch (err) {
            console.log(err)
        }
    }

    public async getProviders(vault: IContext): Promise<BaseProvider[]> {
        const datastore = await this.getConnectionDatastore(vault)
        const allProviders = Object.keys(CONFIG.providers)
        const userProviders = []
        for (let p in allProviders) {
            const providerName = allProviders[p]
            
            try {
                const connection = <Connection> await datastore.get(providerName, {})
                const provider = Providers(providerName, connection)
                userProviders.push(provider)
                
            } catch (err) {
                console.log(err)
                // skip non-existent connections or broken providers
            }
        }

        return userProviders
    }

    public async getConnectionDatastore(vault: IContext): Promise<IDatastore> {
        if (this.connectionDatastore) {
            return this.connectionDatastore
        }

        this.connectionDatastore = await vault.openDatastore(
            DATA_CONNECTION_SCHEMA
        )

        return this.connectionDatastore
    }

    /**
     * Synchronize data from a third party data source with a local collection of datastores.
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
    public async syncProvider(vault: IContext, provider: BaseProvider): Promise<void> {
        const connection = provider.getConnection()
        const accessToken = connection.accessToken
        const refreshToken = connection.refreshToken

        // @todo: Set properly from the vault datastore
        const syncSchemas: Record<string, SyncSchemaConfig> = {}

        // Generate a new sync request
        const syncRequestDatastore = await vault.openDatastore(DATA_SYNC_REQUEST_SCHEMA)
        
        const syncRequestResult = <DatastoreSaveResponse> await syncRequestDatastore.save({
            source: provider.getProviderId(),
            requestStart: (new Date()).toISOString(),
            status: 'requested'
        }, {})
        const syncRequest = await syncRequestDatastore.get(syncRequestResult.id, {})
        if (!syncRequest.syncInfo) {
            syncRequest.syncInfo = {}
        }

        // Fetch the necessary data from the provider
        let data: any = {}
        try {
            data = await provider.sync(accessToken, refreshToken, syncSchemas)
        } catch (err: any) {
            syncRequest.status = 'error'
            if (err instanceof TokenExpiredError) {
                syncRequest.syncInfo.error = `Token expired, please reconnect.`
            }
            else {
                syncRequest.syncInfo.error = err.message
            }

            await syncRequestDatastore.save(syncRequest, {})

            // @todo: Check if this code is needed
            /*
            // Add a delay so the sync request has time to sync
            await delay(2000)

            await context.close({
                clearLocal: true
            })*/

            return
        }

        // Add account auth info if it has changed
        const newAuth = provider.getAccountAuth()
        if (newAuth) {
            connection.accessToken = newAuth.accessToken
            connection.refreshToken = newAuth.refreshToken
        }

        // Add latest profile info
        connection.profile = await provider.getProfile(this.did, vault)

        const connectionDatastore = await this.getConnectionDatastore(vault)
        await connectionDatastore.save(connection, {})

        const response: any = {}
        const syncingDatabases = []

        // iterate through the data and save it into the appropriate datastore
        // NOTE: database stores data for all providers, not just this one being processed
        for (var schemaUri in data) {
            // open a datastore where the user has permission to access the datastores
            const datastore = await vault.openDatastore(schemaUri)

            logger.info(`Inserting ${data[schemaUri].length} records into datastore: ${schemaUri}`)

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
                            logger.error(datastore.errors)
                            logger.error(record)
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
            } catch (err) {
                logger.error(err.status, err.name)
            }

            await datastore.close({
                clearLocal: true
            })
        }
        
        syncRequest.status = "complete"
        await syncRequestDatastore.save(syncRequest, {})

        logger.info(`sync request saved for ${provider.getProviderId()}`)
    }

}