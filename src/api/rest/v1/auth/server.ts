import { ContextSession, DatabasePermissionOptionsEnum, IContext, IDatabase, Network } from "@verida/types"
import CONFIG from "../../../../config"
import { Client, Context } from "@verida/client-ts"
import { AutoAccount } from "@verida/account-node"
import EncryptionUtils from "@verida/encryption-utils";
import { APIKeyData, AuthRequest, AuthToken } from "./interfaces"
import { AuthUser } from "./user"
import { expandScopes } from "./scopes";

const SERVER_CONTEXT_NAME = 'Verida: Data Connector Server'
const DID_CLIENT_CONFIG = CONFIG.verida.didClientConfig

const API_KEY_SESSION_LENGTH = 48

class AuthServer {
    private network: Network
    private privateKey: string
    private context: Context

    private did?: string

    constructor(privateKey: string, network: Network) {
        this.network = network
        this.privateKey = privateKey
    }

    public async verifyAuthToken(token: string, requestedScopes?: string[]): Promise<{
        session: ContextSession
        tokenId: string,
        readAccessDatastoreSchemas: string[],
        appDID: string
    }> {
        await this._init()

        if (token.length != 84) {
            throw new Error(`Invalid token (corrupt)`)
        }

        try {
            const authTokenId = token.substring(0,36)
            const part1 = token.substring(36)

            const serverKeyDb = await this.context.openDatabase('api_keys')
            // @todo: fix typing
            const authTokenKeyData = <any> await serverKeyDb.get(authTokenId)

            const encryptedAPIKeyData = `${part1}${authTokenKeyData.part2}`
            const encryptionKey = EncryptionUtils.decodeBase64(authTokenKeyData.encryptionKey)

            // const encryptedAPIKeyData = EncryptionUtils.decodeBase64(b64EncryptedAPIKeyData)
            const apiKeyDataString = EncryptionUtils.symDecrypt(encryptedAPIKeyData, encryptionKey)
            const apiKeyData = JSON.parse(apiKeyDataString)

            const {
                session,
                scopes,
                // userDID,
                // appDID,
            } = apiKeyData

            const { resolvedScopes } = expandScopes(scopes)

            // Verify requested scopes matches user granted scopes
            for (const scope of requestedScopes) {
                if (resolvedScopes && resolvedScopes.indexOf(scope) === -1) {
                    // Scope not found
                    throw new Error(`Invalid token (invalid scope: ${scope})`)
                }
            }

            // Build a list of datastore read scopes
            const readAccessDatastoreSchemas: string[] = []
            for (const scope of resolvedScopes) {
                const dsMatches = scope.match("^ds:r:(.*)")
                if (dsMatches && dsMatches.length == 2) {
                    readAccessDatastoreSchemas.push(dsMatches[1])
                }
            }

            // Return a ContextSession instance
            return {
                session: <ContextSession> JSON.parse(Buffer.from(session, 'base64').toString('utf-8')),
                tokenId: authTokenId,
                readAccessDatastoreSchemas,
                appDID: this.did
            }
        } catch (err: any) {
            if (err.message.match('missing')) {
                throw new Error('Invalid token (not found)')
            }

            throw new Error(err.message)
        }
    }

    public async createAuthToken(apiKeyData: APIKeyData, authUser: AuthUser, sessionString: string): Promise<string> {
        // Generate encryption key
        const encryptionKey = EncryptionUtils.randomKey(32)
        const b64Key = EncryptionUtils.encodeBase64(encryptionKey)

        const apiKeyDataString = JSON.stringify(apiKeyData)
        const encryptedAPIKeyData = EncryptionUtils.symEncrypt(apiKeyDataString, encryptionKey)
        
        // Split the b64 session string into two parts, with the last part 48 bytes long
        const part1 = encryptedAPIKeyData.substring(0, API_KEY_SESSION_LENGTH)
        const part2 = encryptedAPIKeyData.substring(API_KEY_SESSION_LENGTH)

        const appKeyData = {
            // _id: auto generated
            encryptionKey: b64Key,
            part2
        }

        const serverKeyDb = await this.context.openDatabase('api_keys')
        const result: any = await serverKeyDb.save(appKeyData)
        const apiKeyId = result.id
        await serverKeyDb.get(apiKeyId)

        const endpointUri = CONFIG.serverUrl
        const authToken: AuthToken = {
            _id: apiKeyId,
            servers: [endpointUri],
            scopes: apiKeyData.scopes,
            appDID: apiKeyData.appDID
        }

        await authUser.saveAuthToken(authToken)

        const apiKey = `${apiKeyId}${part1}`
        return apiKey
    }

    public async generateAuthToken(authRequest: AuthRequest, authUser: AuthUser, sessionString: string): Promise<string> {
        await this._init()

        const apiKeyData: APIKeyData = {
            session: sessionString,
            scopes: authRequest.scopes,
            userDID: authRequest.userDID,
            appDID: authRequest.appDID
        }

        return this.createAuthToken(apiKeyData, authUser, sessionString)
    }

    public async revokeToken(authUser: AuthUser, tokenId: string): Promise<void> {
        try {
            // Delete the token from the server
            const serverKeyDb = await this.context.openDatabase('api_keys')
            await serverKeyDb.delete(tokenId)

            // Delete the token from the user database
            await authUser.deleteAuthToken(tokenId)
        } catch (err) {
            throw new Error(`Invalid token (${err.message})`)
        }
    }

    protected async _init(): Promise<void> {
        if (this.context) {
            return
        }

        const network = new Client({
            network: this.network
        })

        const account = new AutoAccount({
            privateKey: this.privateKey,
            network: this.network,
            // @ts-ignore
            didClientConfig: DID_CLIENT_CONFIG
        })

        this.did = await account.did()

        await network.connect(account)
        this.context = <Context> await network.openContext(SERVER_CONTEXT_NAME)
    }

    private async getDb(dbName: string): Promise<IDatabase> {
        await this._init()
        return await this.context.openDatabase(dbName)
    }

}

const privateKey = CONFIG.verida.serverKey
const network = <Network> CONFIG.verida.environment
const server = new AuthServer(privateKey, network)

export default server