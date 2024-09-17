import CONFIG from './config'
import { IContext, IDatastore } from "@verida/types";
import Providers from "./providers"
import { Connection, SyncStatus, SyncFrequency, ConnectionProfile, ConnectionHandler, PassportProfile } from './interfaces';
import BaseProvider from './providers/BaseProvider';
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

    private vault: IContext
    private requestId: string

    private connectionDatastore?: IDatastore
    private connections?: BaseProvider[]

    private status: SyncStatus = SyncStatus.CONNECTED

    public constructor(vaultContext: IContext, requestId: string = 'none') {
        this.vault = vaultContext
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

    public async getConnection(connectionId: string): Promise<Connection | undefined> {
        const connectionDs = await this.getConnectionDatastore()
        const connectionRecord = <Connection | undefined> await connectionDs.get(connectionId, {})
        return connectionRecord
    }

    public async getProvider(connectionId: string): Promise<BaseProvider | undefined> {
        const connectionRecord = await this.getConnection(connectionId)
        const providers = <BaseProvider[]> await this.getProviders(connectionRecord.providerId, connectionRecord.accountId)
        if (providers.length) {
            return providers[0]
        }
    }

    public async getProviders(providerId?: string, accountId?: string): Promise<BaseProvider[]> {
        if (this.connections) {
            if (providerId) {
                const connections = []

                for (const connection of this.connections) {
                    if (connection.getProviderId() != providerId) {
                        continue
                    }

                    if (!accountId || connection.getAccountId() == accountId) {
                        connections.push(connection)
                    }
                }

                return connections
            }

            return this.connections
        }

        const datastore = await this.getConnectionDatastore()
        const allProviders = providerId ? [providerId] : Object.keys(CONFIG.providers)
        const userConnections = []
        for (let currentProviderId of allProviders) {
            try {
                const filter: Record<string, string> = {
                    providerId: currentProviderId
                }

                if (accountId) {
                    filter.accountId = accountId
                }

                const connections = <Connection[]> await datastore.getMany(filter, {})
                for (const connection of connections) {
                    const provider = Providers(currentProviderId, this.vault, connection)
                    userConnections.push(provider)
                }
                
            } catch (err) {
                console.log(err)
                // skip non-existent connections or broken providers
            }
        }

        if (accountId) {
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

        this.connectionDatastore = await this.vault.openDatastore(
            DATA_CONNECTION_SCHEMA
        )

        return this.connectionDatastore
    }

    public async saveProvider(providerName: string, accessToken: string, refreshToken: string, profile: PassportProfile): Promise<Connection> {
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
            avatar: {
                uri: profile.photos && profile.photos.length ? profile.photos[0].value : undefined
            },
            readableId: `${profile.displayName} (${profile.id})`,
            //uri: 
            givenName: profile.name.givenName,
            familyName: profile.name.familyName,
            email: profile.emails && profile.emails.length ? profile.emails[0].value : undefined,
            ...(profile.connectionProfile ? profile.connectionProfile : {})
        }

        const provider = Providers(providerName)
        const handlers = await provider.getSyncHandlers()
        const connectionHandlers: ConnectionHandler[] = []

        // Set default values for connection handlers
        for (const handler of handlers) {
            const handlerOptions = handler.getOptions()
            const handlerConfig: Record<string, string> = {}

            for (const handlerOption of handlerOptions) {
                handlerConfig[handlerOption.id] = handlerOption.defaultValue
            }

            connectionHandlers.push({
                id: handler.getId(),
                enabled: true,
                config: handlerConfig
            })
        }

        const providerConfig: Record<string, string> = {}
        for (const providerOption of provider.getOptions()) {
            providerConfig[providerOption.id] = providerOption.defaultValue
        }

        providerConnection = {
            ...(providerConnection ? providerConnection : {}),
            _id: providerId,
            name: providerId,
            providerId: providerName,
            accountId: profile.id,
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

        return providerConnection
    }

}