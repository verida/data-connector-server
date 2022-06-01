
const assert = require("assert")
import Axios from 'axios'
import { EnvironmentType, Context, Client, ContextInterfaces } from '@verida/client-ts'
import { AutoAccount } from '@verida/account-node'

import CONFIG from "../src/config"
import Datastore from '@verida/client-ts/dist/context/datastore'

const SERVER_URL = CONFIG.serverUrl
const TEST_VAULT_CONTEXT = 'Verida: Fake Vault'
const TEST_VAULT_PRIVATE_KEY = '0x78d3b996ec98a9a536efdffbae40e5eaaf117765a587483c69195c9460165c37'

const VERIDA_ENVIRONMENT = EnvironmentType.TESTNET
const VERIDA_TESTNET_DEFAULT_SERVER = 'https://db.testnet.verida.io:5002/'

const axios = Axios.create()

export default class CommonUtils {

    static getNetwork = async (): Promise<any> => {
        const network = new Client({
            environment: VERIDA_ENVIRONMENT
        })

        const account = new AutoAccount({
            defaultDatabaseServer: {
                type: 'VeridaDatabase',
                endpointUri: VERIDA_TESTNET_DEFAULT_SERVER
            },
            defaultMessageServer: {
                type: 'VeridaMessage',
                endpointUri: VERIDA_TESTNET_DEFAULT_SERVER
            }
        }, {
            privateKey: TEST_VAULT_PRIVATE_KEY,
            environment: VERIDA_ENVIRONMENT
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

    static openSchema = async (context: Context, contextName: string, schemaName: string, databaseName: string, encryptionKey: string, externalDid: string, did: string): Promise<any> => {
        const key = Buffer.from(encryptionKey, 'hex')

        const externalDatastore = await context.openExternalDatastore(schemaName, externalDid, {
            permissions: {
                read: ContextInterfaces.PermissionOptionsEnum.USERS,
                write: ContextInterfaces.PermissionOptionsEnum.USERS,
                readList: [did],
                writeList: [did]
            },
            // @ts-ignore
            encryptionKey: key,
            databaseName,
            contextName
        })

        return externalDatastore
    }

    static closeDatastore = async (datastore: Datastore): Promise<any> => {
        const db = await datastore.getDb()
        await db._localDb.destroy()
    }
}