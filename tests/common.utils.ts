const assert = require("assert")
import Axios from 'axios'
import { Context, Client } from '@verida/client-ts'
import { AutoAccount } from '@verida/account-node'

import serverconfig from '../src/serverconfig.json'
import Datastore from '@verida/client-ts/dist/context/datastore'
import { DatabasePermissionOptionsEnum, EnvironmentType } from '@verida/types'

const SERVER_URL = serverconfig.serverUrl
const TEST_VAULT_CONTEXT = serverconfig.testing.contextName
const TEST_VAULT_PRIVATE_KEY = serverconfig.testing.veridaPrivateKey

const VERIDA_ENVIRONMENT = <EnvironmentType> serverconfig.verida.environment
const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig

const DATA_SYNC_REQUEST_SCHEMA = 'https://vault.schemas.verida.io/data-connections/sync-request/v0.1.0/schema.json'

const axios = Axios.create()

export default class CommonUtils {

    static getNetwork = async (): Promise<any> => {
        const network = new Client({
            environment: VERIDA_ENVIRONMENT
        })

        const account = new AutoAccount(serverconfig.verida.defaultEndpoints, {
            privateKey: TEST_VAULT_PRIVATE_KEY,
            environment: VERIDA_ENVIRONMENT,
            // @ts-ignore
            didClientConfig: DID_CLIENT_CONFIG
        })

        await network.connect(account);
        const context = await network.openContext(TEST_VAULT_CONTEXT)
        const did = await account.did()

        return {
            did,
            network,
            context,
            account
        }
    }

    static syncConnector = async (provider: string, accessToken: string, refreshToken: string, did: string, encryptionKey: string): Promise<any> => {
        return await axios.get(`${SERVER_URL}/sync/${provider}?accessToken=${accessToken}&refreshToken=${refreshToken}&did=${did}&key=${encryptionKey}`)
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
                break
            } catch (err) {
                console.log(err.message)
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