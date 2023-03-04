import { EnvironmentType } from '@verida/types'
import { AutoAccount } from "@verida/account-node"
import { Client, Context } from "@verida/client-ts"
import { Credentials } from '@verida/verifiable-credentials'
import Providers from "./providers"
import fs from 'fs'
import serverconfig from '../src/serverconfig.json'

const CONTEXT_NAME = serverconfig.verida.contextName
const PRIVATE_KEY = serverconfig.verida.privateKey
const DEFAULT_ENDPOINTS = serverconfig.verida.defaultEndpoints
const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig

const REPUTATION_CREDENTIAL_SCHEMA = 'https://common.schemas.verida.io/social/credential/v0.1.0/schema.json'

export {
    CONTEXT_NAME,
    PRIVATE_KEY,
    DEFAULT_ENDPOINTS,
    DID_CLIENT_CONFIG,
    REPUTATION_CREDENTIAL_SCHEMA
}

export class Utils {

    /**
     * Get a network, context and account instance
     * 
     * @returns 
     */
    public static async getNetwork(): Promise<any> {
        const VERIDA_ENVIRONMENT = Utils.strToEnvType(serverconfig.verida.environment)
        const network = new Client({
            environment: VERIDA_ENVIRONMENT
        })
        const account = new AutoAccount(DEFAULT_ENDPOINTS, {
            privateKey: PRIVATE_KEY,
            environment: VERIDA_ENVIRONMENT,
            // @ts-ignore
            didClientConfig: DID_CLIENT_CONFIG
        })
        await network.connect(account)
        const context = await network.openContext(CONTEXT_NAME)

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
                label: provider.getLabel(),
                icon: provider.icon ? provider.icon : `${serverconfig.assetsUrl}/${providerName}/icon.png`
            })
        }

        return providerList
    }

    public static async buildCredential(
        credentialData: Record<string, string>,
        context: Context,
      ): Promise<any> {
        const credentials = new Credentials();

        return await credentials.createVerifiableCredentialRecord({
            context: context as any,
            data: credentialData,
            subjectId: credentialData.did,
            schema: REPUTATION_CREDENTIAL_SCHEMA
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