import { IDatabase, Network } from "@verida/types"
import CONFIG from "../../../../config"
import { Client, Context } from "@verida/client-ts"
import { AutoAccount } from "@verida/account-node"
import { VeridaOAuthClient } from "./client"
import { VeridaOAuthUser } from "./user"
import { AuthCodeRecord, OAuthToken, VeridaOAuthCode, VeridaOAuthToken } from "./interfaces"

const VAULT_CONTEXT_NAME = 'Verida: Vault'
const DID_CLIENT_CONFIG = CONFIG.verida.didClientConfig

const DB_PENDING_REQUEST = "oauth_pending_requests"
const DB_TOKEN = "oauth_tokens"

// @todo: remove
let lastToken: VeridaOAuthToken

class VeridaOAuthServer {
    private network: Network
    private privateKey: string
    private context: Context

    private did?: string

    constructor(privateKey: string, network: Network) {
        this.network = network
        this.privateKey = privateKey
    }

    public async saveAuthorizationCode(code: VeridaOAuthCode, client: VeridaOAuthClient, user: VeridaOAuthUser): Promise<object> {
        console.log('saveAuthorizationCode()')

        const requestDb = await this.getDb(DB_PENDING_REQUEST)
        const pendingRequest: AuthCodeRecord = {
            _id: code.authorizationCode,
            expiresAt: code.expiresAt.toISOString(),
            redirectUri: code.redirectUri,
            scope: code.scope,
            appDID: client.id,
            userDID: user.id,
            insertedAt: (new Date()).toISOString()
        }

        await requestDb.save(pendingRequest)

        // @todo: Garbage collect expired requests

        return {
            code,
            client,
            user
        }
    }

    public async getAuthorizationCode(code: string): Promise<VeridaOAuthCode> {
        console.log('getAuthorizationCode()')

        const requestDb = await this.getDb(DB_PENDING_REQUEST)
        const request = <AuthCodeRecord | undefined> await requestDb.get(code)

        if (!request) {
            throw new Error(`Invalid authorization code (not found)`)
        }

        const client = new VeridaOAuthClient(request.appDID)
        const user = new VeridaOAuthUser(request.userDID)

        return {
            authorizationCode: request._id,
            expiresAt: new Date(request.expiresAt),
            redirectUri: request.redirectUri,
            scope: request.scope,
            client,
            user
        }
    }

    public async revokeAuthorizationCode(code: string): Promise<boolean> {
        // Delete from `oauth_pending_requests` database
        console.log('revokeAuthorizationCode()')

        const requestDb = await this.getDb(DB_PENDING_REQUEST)
        return await requestDb.delete(code)
    }

    public async saveToken(token: OAuthToken, client: VeridaOAuthClient, user: VeridaOAuthUser): Promise<VeridaOAuthToken> {
        // @todo: Save to `oauth_tokens` database
        console.log('saveToken()')

        lastToken = {
            accessToken: token.accessToken,
            accessTokenExpiresAt: token.accessTokenExpiresAt,
            refreshToken: token.refreshToken,
            refreshTokenExpiresAt: token.refreshTokenExpiresAt,
            scope: token.scope,
            client,
            user
        }

        return lastToken
    }

    public async getClient(clientId: string, clientSecret: string): Promise<any> {
        console.log('getClient', clientId, clientSecret)
        const client = new VeridaOAuthClient("0x")
        client.redirectUris = ["https://insertyourdomain.com/verida/auth-response"]

        return client
    }

    /**
     * Invoked to retrieve an existing access token previously saved through Model#saveToken().
     * @param accessToken 
     */
    public async getAccessToken(accessToken: string): Promise<VeridaOAuthToken> {
        console.log('getAccessToken()')
        throw new Error(" not implemented")
    }

    public async revokeToken(token: OAuthToken): Promise<boolean> {
        // @todo Delete refresh token from `oauth_tokens` database
        console.log('revokeToken()')
        return true
    }

    /**
     * Invoked to retrieve an existing access token previously saved through Model#saveToken().
     * @param accessToken 
     */
    public async getRefreshToken(refreshToken: string): Promise<VeridaOAuthToken> {
        // @todo Fetch from oauth_tokens database
        console.log('getRefreshToken()')
        return lastToken
    }

    /**
     * Invoked to check if the requested scope is valid for a particular client/user combination.
     * This function is optional. If not implemented, any scope is accepted.
     * 
     * @param user 
     * @param client 
     * @param scopes 
     * @returns 
     */
    public async validateScope(user: any, client: VeridaOAuthClient, scopes: string[]): Promise<string[]> {
        // @todo: Verify the scopes match for the user User.verifyScopes(scopes) ?
        console.log('validateScope()')

        return scopes
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

        this.context = <Context> await network.openContext(VAULT_CONTEXT_NAME)
    }

    private async getDb(dbName: string): Promise<IDatabase> {
        await this._init()
        return await this.context.openDatabase(dbName)
    }

}

const privateKey = CONFIG.verida.serverKey
const network = <Network> CONFIG.verida.environment
const server = new VeridaOAuthServer(privateKey, network)

export default server