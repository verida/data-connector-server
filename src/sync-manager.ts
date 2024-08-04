import CONFIG from './config'
import { IContext, IDatastore } from "@verida/types";
import Providers from "./providers"
import { Connection, DatastoreSaveResponse, SyncStatus, SyncFrequency, ConnectionProfile, ConnectionHandler } from './interfaces';
import BaseProvider from './providers/BaseProvider';
import TokenExpiredError from './providers/TokenExpiredError';
import { Utils } from './utils';
import serverconfig from './config';

const log4js = require("log4js")
const logger = log4js.getLogger()

const DATA_CONNECTION_SCHEMA = serverconfig.verida.schemas.DATA_CONNECTIONS
const DATA_SYNC_REQUEST_SCHEMA = serverconfig.verida.schemas.SYNC_REQUEST

const delay = async (ms: number) => {
    await new Promise((resolve: any) => setTimeout(() => resolve(), ms))
}

/**
 * Manage the syncronization of all the connections for a given DID
 */
export default class SyncManager {

    private vault?: IContext
    private did: string
    private seedPhrase: string

    private connectionDatastore?: IDatastore
    private connections?: BaseProvider[]

    private status: SyncStatus = SyncStatus.ACTIVE

    public constructor(did: string, seedPhrase: string) {
        this.did = did
        this.seedPhrase = seedPhrase
    }

    /**
     * Check-in to determine if processing is required
     * 
     * @returns boolean `true` if processing, `false` if nothing left to process
     */
    public async checkIn(): Promise<boolean> {
        await this.init()

        switch (this.status) {
            case SyncStatus.ACTIVE:
                // @todo: check if enough time has elapsed before syncing again
                await this.sync()
                return true
            // @todo: Handle other cases
        }

        return false
    }

    public async sync(providerName?: string, providerId?: string) {
        const vault = await this.getVault()

        const providers = await this.getProviders(providerName, providerId)
        // @todo: Do these in parallel?
        // May need a shared cache of datastore connections so we 
        // don't try to open the same one multiple times
        for (let p in providers) {
            const provider = providers[p]
            await this.syncProvider(provider)
        }
    }

    private async init(): Promise<void> {
        // This initializes the vault and connection datastore
        await this.getProviders()

    }

    public async getVault(): Promise<IContext> {
        if (this.vault) {
            return this.vault
        }

        try {
            const { context } = await Utils.getNetwork(this.did, this.seedPhrase)

            this.vault = <IContext> context
            return this.vault
        } catch (err) {
            console.log(err)
        }
    }

    public async getProviders(providerName?: string, providerId?: string): Promise<BaseProvider[]> {
        if (this.connections) {
            return this.connections
        }

        const vault = await this.getVault()

        const datastore = await this.getConnectionDatastore()
        const allProviders = providerName ? [providerName] : Object.keys(CONFIG.providers)
        const userConnections = []
        for (let p in allProviders) {
            const providerName = allProviders[p]
            
            try {
                const filter: Record<string, string> = {
                    provider: providerName
                }

                if (providerId) {
                    filter.providerId = providerId
                }

                const connections = <Connection[]> await datastore.getMany(filter, {})
                for (const connection of connections) {
                    const provider = Providers(providerName, vault, connection)
                    userConnections.push(provider)
                }
                
            } catch (err) {
                console.log(err)
                // skip non-existent connections or broken providers
            }
        }

        if (providerName) {
            return userConnections
        } else {
            // Save the connections if we fetched all of them
            this.connections = userConnections
            return this.connections
        }
    }

    public async getConnectionDatastore(): Promise<IDatastore> {
        if (this.connectionDatastore) {
            return this.connectionDatastore
        }

        const vault = await this.getVault()

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
    public async syncProvider(provider: BaseProvider): Promise<void> {
        const connection = provider.getConnection()
        const accessToken = connection.accessToken
        const refreshToken = connection.refreshToken

        // Generate a new sync request
        const vault = await this.getVault()
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

        // Fetch the latest data from the provider (if required)


        // Backfill data from the provider (if required)

        // Fetch the necessary data from the provider
        let data: any = {}
        try {
            data = await provider.sync(accessToken, refreshToken)
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
        connection.profile = await provider.getProfile()

        const connectionDatastore = await this.getConnectionDatastore()
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

    public async saveProvider(providerName: string, accessToken: string, refreshToken: string, profile: any) {
        const connectionDatastore = await this.getConnectionDatastore()

        const providerId = `${providerName}:${profile.id}`

        let providerConnection: Connection
        try {
            providerConnection = await connectionDatastore.get(providerId, {})
        } catch (err: any) {
            if (!err.message.match('missing')) {
                throw new Error(`Unknown error saving ${providerName} (${providerId}) auth tokens: ${err.message}`)
            }
        }

        const connectionProfile: ConnectionProfile = {
            id: profile.id,
            name: profile.displayName,
            avatarUrl: profile.photos && profile.photos.length ? profile.photos[0].value : undefined,
            //uri: 
            givenName: profile.name.givenName,
            familyName: profile.name.familyName,
            email: profile.emails && profile.emails.length ? profile.emails[0].value : undefined,
            emailVerified: profile.emails && profile.emails.length ? profile.emails[0].verified : undefined,
        }

        const provider = Providers(providerName)
        const handlers = await provider.getSyncHandlers()
        const connectionHandlers: ConnectionHandler[] = []

        for (const handler of handlers) {
            const handlerOptions = handler.getOptions()
            const handlerConfig: Record<string, string> = {}

            for (const handlerOption of handlerOptions) {
                handlerConfig[handlerOption.name] = handlerOption.defaultValue
            }

            connectionHandlers.push({
                name: handler.getName(),
                enabled: true,
                config: handlerConfig
            })
        }

        const providerConfig: Record<string, string> = {}
        for (const providerOption of provider.getOptions()) {
            providerConfig[providerOption.name] = providerOption.defaultValue
        }

        providerConnection = {
            ...(providerConnection ? providerConnection : {}),
            _id: providerId,
            name: providerId,
            provider: providerName,
            providerId: profile.id,
            accessToken,
            refreshToken,
            profile: connectionProfile,
            syncStatus: SyncStatus.ACTIVE,
            syncFrequency: SyncFrequency.HOUR,
            handlers: connectionHandlers,
            config: providerConfig
        }

        const result = await connectionDatastore.save(providerConnection, {})

        if (!result) {
            throw new Error(`Unable to save connection: ${JSON.stringify(connectionDatastore.errors, null, 2)}`)
        }
    }

}