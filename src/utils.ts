import { Network as VeridaNetwork, IContext } from '@verida/types'
import { Client, Network } from "@verida/client-ts"
import { Credentials } from '@verida/verifiable-credentials'
import Providers from "./providers"
import fs from 'fs'
import serverconfig from './config'
import { AutoAccount } from '@verida/account-node'
import { SyncSchemaPositionType } from './interfaces'

const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig

const SBT_CREDENTIAL_SCHEMA = 'https://common.schemas.verida.io/token/sbt/credential/v0.1.0/schema.json'

export {
    DID_CLIENT_CONFIG,
    SBT_CREDENTIAL_SCHEMA
}

export class Utils {

    /**
     * Get a network, context and account instance
     * 
     * @returns 
     */
    public static async getNetwork(did: string, contextSignature: string): Promise<{
        network: Network,
        context: IContext,
        account: AutoAccount
        //account: ContextAccount
    }> {
        const VAULT_CONTEXT_NAME = 'Verida: Vault'
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
        await network.connect(account)
        const context = await network.openContext(VAULT_CONTEXT_NAME)

        return {
            network,
            context,
            account
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

    public static buildSyncHandlerId(providerName: string, providerId: string, handlerName: string, type: SyncSchemaPositionType) {
        return `${providerName}:${providerId}:${handlerName}:${type}`
    }

    public static datastoreErorrsToString(errors: any): string {
        let result = ''
        for (let e in errors) {
            const error = errors[e]
            result += `${error.keyword}: ${error.message}`
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
}

const VERIDA_ENVIRONMENT = <VeridaNetwork> serverconfig.verida.environment

export { VERIDA_ENVIRONMENT }