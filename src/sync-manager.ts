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
    private requestId: string

    private connectionDatastore?: IDatastore
    private connections?: BaseProvider[]

    private status: SyncStatus = SyncStatus.CONNECTED

    public constructor(did: string, seedPhrase: string, requestId: string = 'none') {
        this.did = did
        this.seedPhrase = seedPhrase
        this.requestId = requestId
    }

    /**
     * Check-in to determine if processing is required
     * 
     * @returns boolean `true` if processing, `false` if nothing left to process
     */
    public async checkIn(): Promise<boolean> {
        await this.init()

        switch (this.status) {
            case SyncStatus.CONNECTED:
                // @todo: check if enough time has elapsed before syncing again
                await this.sync()
                return true
            // @todo: Handle other cases
        }

        return false
    }

    public async sync(providerName?: string, providerId?: string, force: boolean = false): Promise<Connection[]> {
        const connections: Connection[] = []

        const providers = await this.getProviders(providerName, providerId)
        // @todo: Do these in parallel?
        // May need a shared cache of datastore connections so we 
        // don't try to open the same one multiple times
        for (let p in providers) {
            const provider = providers[p]
            connections.push(await provider.sync(undefined, undefined, force))
        }

        return connections
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
            const { context } = await Utils.getNetwork(this.seedPhrase, this.requestId)

            this.vault = <IContext> context
            return this.vault
        } catch (err) {
            console.log(err)
        }
    }

    public async getProviders(providerName?: string, providerId?: string): Promise<BaseProvider[]> {
        if (this.connections) {
            if (providerName) {
                const connections = []

                for (const connection of this.connections) {
                    if (connection.getProviderName() != providerName) {
                        continue
                    }

                    if (!providerId || connection.getProviderId() == providerId) {
                        connections.push(connection)
                    }
                }

                return connections
            }

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
            syncStatus: SyncStatus.CONNECTED,
            syncFrequency: SyncFrequency.HOUR,
            handlers: connectionHandlers,
            config: providerConfig
        }

        const result = await connectionDatastore.save(providerConnection, {})

        if (!result) {
            throw new Error(`Unable to save connection: ${JSON.stringify(connectionDatastore.errors, null, 2)}`)
        }
    }

    // public async disconnectProvider(providerName: string, providerId: string): Promise<void> {
    //     const providers = await this.getProviders(providerName, providerId)

    //     if (!providers.length) {
    //         throw new Error(`Unable to locate provider: ${providerName} (${providerId})`)
    //     }

    //     const provider = providers[0]
    //     await provider.disconnect()
    // }

}