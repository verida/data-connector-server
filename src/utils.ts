import { Network as VeridaNetwork, IContext } from '@verida/types'
import { Client } from "@verida/client-ts"
import { Credentials } from '@verida/verifiable-credentials'
import Providers from "./providers"
import fs from 'fs'
import serverconfig from './config'
import { AutoAccount } from '@verida/account-node'
import { Request } from 'express'

const VAULT_CONTEXT_NAME = 'Verida: Vault'
const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig
const SBT_CREDENTIAL_SCHEMA = 'https://common.schemas.verida.io/token/sbt/credential/v0.1.0/schema.json'

export {
    DID_CLIENT_CONFIG,
    SBT_CREDENTIAL_SCHEMA
}

export interface NetworkConnectionCache {
    requestIds: string[],
    currentPromise?: Promise<void>,
    networkConnection?: NetworkConnection
}

export interface NetworkConnection {
    network: Client,
    context: IContext,
    account: AutoAccount,
    did: string
}

export class Utils {

    protected static networkCache: Record<string, NetworkConnectionCache> = {}

    public static async getNetworkFromRequest(req: Request): Promise<NetworkConnection> {
        const headers = req.headers
        const key = headers["key"] ? headers["key"].toString() : req.query.key.toString()
        const contextName = headers["context-name"] ? headers["context-name"].toString() : VAULT_CONTEXT_NAME

        return Utils.getNetwork(key)
    }

    /**
     * Get a network, context and account instance
     * 
     * @returns 
     */
    public static async getNetwork(contextSignature: string, requestId: string = 'none'): Promise<NetworkConnection> {
        const VERIDA_ENVIRONMENT = <VeridaNetwork> serverconfig.verida.environment
        const network = new Client({
            network: VERIDA_ENVIRONMENT
        })

        // @todo: Switch to context account once context storage node issue fixed and deployed
        //const account = new ContextAccount({
        const account = new AutoAccount({
            privateKey: contextSignature,
            network: VERIDA_ENVIRONMENT,
            // @ts-ignore
            didClientConfig: DID_CLIENT_CONFIG
        })
        //}, did, VAULT_CONTEXT_NAME)

        const did = await account.did()

        // If we have a promise for changing state, wait for it to complete
        if (Utils.networkCache[did] && Utils.networkCache[did].currentPromise) {
            await Utils.networkCache[did].currentPromise
        }

        if (Utils.networkCache[did]) {
            Utils.networkCache[did].requestIds.push(requestId)
            return Utils.networkCache[did].networkConnection
        }

        // If cache is shutting down, wait until it's shut down
        // if (Utils.networkCache[did] && Utils.networkCache[did].shutting) {
        //     console.log('awaiting shut down promise', requestId)
        //     await Utils.networkCache[did].shuttingPromise
        // }
        Utils.networkCache[did] = {
            requestIds: [requestId]
        }

        Utils.networkCache[did].currentPromise = new Promise(async (resolve, reject) => {
            await network.connect(account)
            const context = await network.openContext(VAULT_CONTEXT_NAME)
    
            const networkConnection = {
                network,
                context,
                account,
                did
            }
    
            Utils.networkCache[did] = {
                requestIds: [requestId],
                networkConnection
            }

            resolve()
        })

        await Utils.networkCache[did].currentPromise
        return Utils.networkCache[did].networkConnection
    }

    public static async closeConnection(did: string, requestId: string = 'none'): Promise<void> {
        Utils.networkCache[did].requestIds = Utils.networkCache[did].requestIds.filter(id => id !== requestId)

        if (Utils.networkCache[did].currentPromise) {
            await Utils.networkCache[did].currentPromise
        }

        if (Utils.networkCache[did].requestIds.length == 0 && !Utils.networkCache[did].currentPromise) {
            Utils.networkCache[did].currentPromise = new Promise((resolve, reject) => {
                Utils.networkCache[did].networkConnection.context.close()
                delete Utils.networkCache[did]
                resolve()
            })
        }
    }

    /**
     * Get a list of all the supported providers
     */
    public static async getProviders(): Promise<any> {
        // Build a list of data source providers from the providers directory
        const providerDirectory = fs.readdirSync('./src/providers')
        const providers = []
        for (let i in providerDirectory) {
            const providerEntry = providerDirectory[i]
            if (providerEntry.match('\\.')) {
                // ignore files (indicated by having a `.` in the name)
                continue
            }

            providers.push(providerEntry)
        }

        // Build up a list of providers
        const providerList = []
        for (let p in providers) {
            const providerName = providers[p]
            const provider = Providers(providerName)
            providerList.push({
                name: providerName, 
                label: provider.getProviderLabel(),
                icon: provider.getProviderImageUrl()
            })
        }

        return providerList
    }

    public static async buildCredential(
        credentialData: Record<string, string>,
        context: IContext,
      ): Promise<any> {
        const credentials = new Credentials();

        return await credentials.createVerifiableCredentialRecord({
            context: context as any,
            data: credentialData,
            subjectId: credentialData.did,
            schema: SBT_CREDENTIAL_SCHEMA
        }, credentialData.name, credentialData.description, credentialData.image)
    }

    public static buildSyncHandlerId(providerName: string, providerId: string, handlerName: string) {
        return `${providerName}:${providerId}:${handlerName}`
    }

    public static datastoreErrorsToString(errors: any): string {
        let result = ''
        for (let e in errors) {
            const error = errors[e]
            result += `[${error.keyword} error] ${error.instancePath} ${error.message}`
        }

        return result
    }

    public static async getDidFromKey(privateKey: string): Promise<string> {
        const network = <VeridaNetwork> serverconfig.verida.environment
      // Initialize Account
      const account = new AutoAccount({
        privateKey,
        network,
        // @ts-ignore
        didClientConfig: DID_CLIENT_CONFIG
      })

      const did = await account.did()
      return did
    }

    public static nowTimestamp() {
        return (new Date()).toISOString()
    }

    public static buildPermissions(req: Request) {
        const permissionsHeader = req.headers['permissions'] ? req.headers['permissions'].toString().toLowerCase() : 'write=owner,read=owner'
        const permissions: Record<string,string> = {}
        const permissionEntries = permissionsHeader.split(',')
        permissionEntries.forEach(item => {
            const splitResults = item.split('=')
            const permission = splitResults[0]
            const userType = splitResults[1]
            permissions[permission] = userType
        })

        return permissions
    }

    public static getSchemaFromParams(base64Schema: string) {
        const buffer = Buffer.from(base64Schema, 'base64')
        return buffer.toString('utf-8')
    }
}

const VERIDA_ENVIRONMENT = <VeridaNetwork> serverconfig.verida.environment

export { VERIDA_ENVIRONMENT }