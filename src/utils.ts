import { Network as VeridaNetwork, IContext, ContextSession, IAccount } from '@verida/types'
import { Client } from "@verida/client-ts"
import { Credentials } from '@verida/verifiable-credentials'
import Providers from "./providers"
import fs from 'fs'
import path from 'path'
import serverconfig from './config'
import { AutoAccount, SessionAccount } from '@verida/account-node'
import { Request } from 'express'
import { Service as AccessService } from './api/rest/v1/access/service'

export const VERIDA_DID_REGEXP =
  /did:vda:(devnet|mainnet|testnet):0x[0-9a-fA-F]{40}/;

const VAULT_CONTEXT_NAME = 'Verida: Vault'
const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig
const SBT_CREDENTIAL_SCHEMA = 'https://common.schemas.verida.io/token/sbt/credential/v0.1.0/schema.json'
const NETWORK_CONNECTION_CACHE_EXPIRY = 60*3 // 3 mins

export {
    DID_CLIENT_CONFIG,
    SBT_CREDENTIAL_SCHEMA
}

export interface NetworkConnectionCache {
    requestIds: string[],
    currentPromise?: Promise<void>,
    networkConnection?: NetworkConnection
    lastTouch: Date
}

export interface NetworkConnection {
    network: Client,
    context: IContext,
    account: IAccount,
    did: string
}

export class Utils {
    protected static networkCache: Record<string, NetworkConnectionCache> = {}

    /**
     * Get a network connection from a request
     *
     * @param req
     * @param options
     * @returns
     */
    public static async getNetworkConnectionFromRequest(req: Request, options?: { ignoreAccessCheck?: boolean, checkAdmin?: boolean }): Promise<NetworkConnection> {
        // Extract session
        let session: ContextSession | undefined;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            session = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } else if (req.query.token) {
            session = JSON.parse(Buffer.from(req.query.token.toString(), 'base64').toString('utf-8'));
        }

        // Extract private key
        const key = req.headers["key"] ? req.headers["key"].toString() : req.query.key?.toString()

        let networkConnection: NetworkConnection
        if (session) {
            networkConnection = await Utils.getNetworkConnectionFromContextSession(session, 'none')
        } else if (key) {
            networkConnection = await Utils.getNetworkConnectionFromPrivateKey(key || '', 'none')
        } else {
            throw new Error("No credentials provided")
        }

        if (!options?.ignoreAccessCheck) {
            const accessService = new AccessService()

            const accessRecord = await accessService.getAccessRecord(networkConnection.did)

            if (!accessRecord?.access) {
                throw new Error("Access denied")
            }

            if (options?.checkAdmin && !accessRecord?.admin) {
                throw new Error("Access denied")
            }
        }

        return networkConnection
    }

    public static didCount() {
        return Object.keys(Utils.networkCache).length
    }

    /**
     * Get a network, context and account instance
     *
     * @returns
     * Get a network connection from a private key
     *
     * @param privateKey
     * @param requestId
     * @returns
     */
    public static async getNetworkConnectionFromPrivateKey(privateKey: string, requestId: string = 'none'): Promise<NetworkConnection> {
        const account = new AutoAccount({
            privateKey,
            network: serverconfig.verida.environment as VeridaNetwork,
            // @ts-ignore
            didClientConfig: DID_CLIENT_CONFIG
        })

        return await Utils.getNetworkConnection(account, requestId)
    }

    /**
     * Get a network connection from a context session.
     *
     * @param contextSession
     * @param requestId
     * @returns
     */
    public static async getNetworkConnectionFromContextSession(contextSession: ContextSession, requestId: string = 'none'): Promise<NetworkConnection> {
        const account = new SessionAccount({
            network: serverconfig.verida.environment as VeridaNetwork,
            contextSession
        })

        return await Utils.getNetworkConnection(account, requestId)
    }

    /**
     * Get a network, context and account instance
     *
     * @returns
     */
    private static async getNetworkConnection(account: SessionAccount | AutoAccount, requestId: string = 'none'): Promise<NetworkConnection> {
        const did = await account.did()

        // If we have a promise for changing state, wait for it to complete
        if (Utils.networkCache[did] && Utils.networkCache[did].currentPromise) {
            await Utils.networkCache[did].currentPromise
        }

        if (Utils.networkCache[did]) {
            Utils.networkCache[did].requestIds.push(requestId)
            Utils.touchNetworkCache(did)

            Utils.gcNetworkCache()
            return Utils.networkCache[did].networkConnection
        }

        // If cache is shutting down, wait until it's shut down
        // if (Utils.networkCache[did] && Utils.networkCache[did].shutting) {
        //     console.log('awaiting shut down promise', requestId)
        //     await Utils.networkCache[did].shuttingPromise
        // }
        Utils.networkCache[did] = {
            requestIds: [requestId],
            lastTouch: new Date()
        }

        const network = new Client({
            network: serverconfig.verida.environment as VeridaNetwork
        })

        Utils.networkCache[did].currentPromise = new Promise(async (resolve, reject) => {
            try {
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
                    lastTouch: new Date(),
                    networkConnection
                }

                resolve()
            } catch (err: any) {
                if (err.message.match('Unable to locate')) {
                    reject(new Error(`Invalid credentials or account is not registered to this network: ${serverconfig.verida.environment}`))
                } else {
                    delete Utils.networkCache[did]
                    reject(err)
                }
            }
        })

        await Utils.networkCache[did].currentPromise
        return Utils.networkCache[did].networkConnection
    }

    public static async touchNetworkCache(did: string) {
        if (Utils.networkCache[did]) {
            Utils.networkCache[did].lastTouch = new Date()
        }
    }

    public static async gcNetworkCache() {
        // console.log("gcNetworkCache()")
        for (const did in Utils.networkCache) {
            const cache = Utils.networkCache[did]
            const duration = ((new Date()).getTime() - cache.lastTouch.getTime())/1000
            // console.log("gcNetworkCache()", duration)
            if (duration > NETWORK_CONNECTION_CACHE_EXPIRY) {
                // Check network connection exists (may not because connection may have failed)
                if (Utils.networkCache[did].networkConnection) {
                    await Utils.networkCache[did].networkConnection.context.close()
                }

                delete Utils.networkCache[did]
            }
        }
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
            const providerId = providers[p]
            const provider = Providers(providerId)
            providerList.push({
                id: providerId,
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

    public static deleteCachedData() {
        // Read all files and folders in the directory
        const directory = "./"
        fs.readdir(directory, (err, files) => {
            if (err) {
                console.error(`Error reading directory: ${err}`);
                return;
            }

            // Loop through each file/folder
            files.forEach(file => {
                const filePath = path.join(directory, file);

                // Check if the name starts with 'v' and it's a directory
                if (file.startsWith('v')) {
                    fs.stat(filePath, (err, stats) => {
                    if (err) {
                        console.error(`Error stating file: ${err}`);
                        return;
                    }

                    if (stats.isDirectory()) {
                        // Recursively delete the directory
                        fs.rm(filePath, { recursive: true, force: true }, (err) => {
                            if (err) {
                                console.error(`Error deleting folder: ${err}`);
                            } else {
                                console.log(`Deleted folder: ${filePath}`);
                            }
                        });
                    }
                    });
                }
            });
        });
    }
}

const VERIDA_ENVIRONMENT = <VeridaNetwork> serverconfig.verida.environment

export { VERIDA_ENVIRONMENT }

/**
 * Check if a string value is a valid Verida DID.
 *
 * @param did The DID or value to test.
 * @returns `true` if a valid Verida DID, `false` otherwise.
 */
export function isValidVeridaDid(did?: string): boolean {
  return did ? VERIDA_DID_REGEXP.test(did) : false;
}
