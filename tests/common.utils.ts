
const assert = require("assert")
import Axios from 'axios'
import { EnvironmentType, Context, Client, ContextInterfaces } from '@verida/client-ts'
import { AutoAccount } from '@verida/account-node'

import serverconfig from '../src/serverconfig.json'
import Datastore from '@verida/client-ts/dist/context/datastore'

const SERVER_URL = serverconfig.serverUrl
const TEST_VAULT_CONTEXT = serverconfig.testing.contextName
const TEST_VAULT_PRIVATE_KEY = serverconfig.testing.veridaPrivateKey

const VERIDA_ENVIRONMENT = <EnvironmentType> serverconfig.verida.environment
const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig

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
        await datastore.close({
            clearLocal: true
        })
    }
}