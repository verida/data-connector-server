import { EnvironmentType, IContext } from '@verida/types'
import { Client, Network } from "@verida/client-ts"
import { Credentials } from '@verida/verifiable-credentials'
import Providers from "./providers"
import fs from 'fs'
import serverconfig from '../src/serverconfig.json'
import { AutoAccount } from '@verida/account-node'

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
        const VERIDA_ENVIRONMENT = Utils.strToEnvType(serverconfig.verida.environment)
        const network = new Client({
            environment: VERIDA_ENVIRONMENT
        })

        // @todo: Switch to context account once context storage node issue fixed and deployed
        //const account = new ContextAccount({
        const account = new AutoAccount({
            privateKey: contextSignature,
            environment: VERIDA_ENVIRONMENT,
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
                icon: provider.icon ? provider.icon : `${serverconfig.assetsUrl}/${providerName}/icon.png`
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

    public static strToEnvType(s: string) { 
        if (s == EnvironmentType.LOCAL) {
            return EnvironmentType.LOCAL;
        } else if (s == EnvironmentType.TESTNET) {
            return EnvironmentType.TESTNET;
        } else if (s == EnvironmentType.MAINNET) {
            return EnvironmentType.MAINNET;
        } else {
            throw new Error("Invalid EnvironmentType value");
        }
    }
}

const VERIDA_ENVIRONMENT = Utils.strToEnvType(serverconfig.verida.environment)

export { VERIDA_ENVIRONMENT }