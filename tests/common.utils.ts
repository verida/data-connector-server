const assert = require("assert")
import Axios from 'axios'
import { Context, Client, Datastore } from '@verida/client-ts'
import { AutoAccount } from '@verida/account-node'

import serverconfig from '../src/serverconfig.json'
import { DatabasePermissionOptionsEnum, EnvironmentType, IContext } from '@verida/types'
import { Connection } from '../src/interfaces'

const SERVER_URL = serverconfig.serverUrl
const TEST_VAULT_PRIVATE_KEY = serverconfig.verida.testVeridaKey
const SCHEMA_DATA_CONNECTION = serverconfig.verida.schemas.DATA_CONNECTIONS
const DATA_SYNC_REQUEST_SCHEMA = serverconfig.verida.schemas.SYNC_REQUEST

const VERIDA_ENVIRONMENT = <EnvironmentType> serverconfig.verida.environment
const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig

const axios = Axios.create()

export interface SyncSchemaConfig {
    limit?: number
    sinceId?: string
}

export interface NetworkInstance {
    did: string,
    network: Client,
    context: IContext,
    account: AutoAccount
}

let cachedNetworkInstance: NetworkInstance

export default class CommonUtils {

    static getNetwork = async (): Promise<NetworkInstance> => {
        if (cachedNetworkInstance) {
            return cachedNetworkInstance
        }

        const network = new Client({
            environment: VERIDA_ENVIRONMENT
        })

        const account = new AutoAccount({
            privateKey: TEST_VAULT_PRIVATE_KEY,
            environment: VERIDA_ENVIRONMENT,
            // @ts-ignore
            didClientConfig: DID_CLIENT_CONFIG
        })

        await network.connect(account);
        const context = await network.openContext('Verida: Vault')
        const did = await account.did()

        cachedNetworkInstance = {
            did,
            network,
            context,
            account
        }

        return cachedNetworkInstance
    }

    static getConnection = async(providerName: string): Promise<Connection> => {
        const { context } = await CommonUtils.getNetwork()
        const connectionsDs = await context.openDatastore(SCHEMA_DATA_CONNECTION)
        const data = await connectionsDs.getMany()
        console.log(data)
        const db = await connectionsDs.getDb()
        const info = await db.info()
        console.log(info)
        const connection = await connectionsDs.get(providerName)
        return connection
    }

    static syncConnector = async (provider: string, accessToken: string, refreshToken: string, did: string, encryptionKey: string, syncSchemas: Record<string, SyncSchemaConfig>): Promise<any> => {
        return await axios.post(`${SERVER_URL}/syncStart/${provider}`, {
            accessToken,
            refreshToken,
            did,
            key: encryptionKey,
            syncSchemas
        })
    }

    static syncDone = async (provider: string, did: string): Promise<any> => {
        return await axios.get(`${SERVER_URL}/syncDone/${provider}`, {
            params: {
                did
            }
        })
    }

    static async openSchema(context: Context, contextName: string, schemaName: string, databaseName: string, encryptionKey: string, externalDid: string, did: string): Promise<any> {
        const externalDatastore = await context.openExternalDatastore(schemaName, externalDid, {
            permissions: {
                read: DatabasePermissionOptionsEnum.USERS,
                write: DatabasePermissionOptionsEnum.USERS,
                readList: [did],
                writeList: [did]
            },
            // @ts-ignore
            encryptionKey: Buffer.from(encryptionKey, 'hex'),
            databaseName,
            contextName
        })

        return externalDatastore
    }

    static getSyncResult = async (connection: any, syncRequestResult: any, encryptionKey: string) => {
        const { serverDid, contextName, syncRequestId, syncRequestDatabaseName } = syncRequestResult.data
            
        let syncResult
        let limit = 10
        while (limit > 0) {
            try {
                const syncRequest = await CommonUtils.openSchema(
                    connection.context,
                    contextName,
                    DATA_SYNC_REQUEST_SCHEMA,
                    syncRequestDatabaseName,
                    encryptionKey,
                    serverDid,
                    connection.did)
                syncResult = await syncRequest.get(syncRequestId)
                await CommonUtils.closeDatastore(syncRequest)

                if (syncResult.status == 'requested') {
                    continue
                }
                break
            } catch (err) {
                limit--
                await CommonUtils.sleep(1000)
            }
        }

        if (!syncResult) {
            throw new Error(`No sync result after 10 seconds`)
        } else {
            return syncResult
        }
    }

    static closeDatastore = async (datastore: Datastore) => {
        await datastore.close({
            clearLocal: true
        })
    }

    static sleep = async (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}