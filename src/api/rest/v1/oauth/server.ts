import { Network } from "@verida/types"
import CONFIG from "../../../../config"
import { Client, Context } from "@verida/client-ts"
import { AutoAccount } from "@verida/account-node"
import { VeridaOAuthClient } from "./client"
import { VeridaOAuthUser } from "./user"

const VAULT_CONTEXT_NAME = 'Verida: Vault'
const DID_CLIENT_CONFIG = CONFIG.verida.didClientConfig

// @todo: remove
let lastToken: VeridaOAuthToken

export interface VeridaOAuthCode {
    authorizationCode: string,
    expiresAt: Date,
    redirectUri: string,
    scope: string[]
    client: VeridaOAuthClient
    user: VeridaOAuthUser
}

export interface VeridaOAuthToken {
    accessToken: string,
    accessTokenExpiresAt: string
    refreshToken?: string
    refreshTokenExpiresAt: string
    scope: string[]
    client: VeridaOAuthClient
    user: VeridaOAuthUser
}

export interface OAuthToken {
    accessToken: string,
    authorizationCode: string,
    accessTokenExpiresAt: string,
    refreshToken: string,
    refreshTokenExpiresAt: string,
    scope: string[]
}

class VeridaOAuthServer {
    private network: Network
    private privateKey: string
    private context: Context

    private did?: string

    constructor(privateKey: string, network: Network) {
        this.network = network
        this.privateKey = privateKey
    }

    public async generateAuthorizationCode(authRequest: string, redirectUrl: string): Promise<string> {
        console.log('generateAuthorizationCode()')
        // @todo: Save to `oauth_pending_requests` database
        // @todo: Garbage collect expired requests

        return "1"
    }

    public async getAuthorizationCode(code: string): Promise<VeridaOAuthCode> {
        console.log('getAuthorizationCode()')
        // @todo: Fetch from `oauth_pending_requests` database

        // 2 minutes from now
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000)

        // @todo: Build proper client and user objects
        const client = new VeridaOAuthClient("0x")
        const user = new VeridaOAuthUser()

        return {
            authorizationCode: code,
            expiresAt,
            redirectUri: "https://insertyourdomain.com/verida/auth-response",
            scope: ["test-scope"],
            client,
            user
        };
    }

    public async revokeAuthorizationCode(code: string): Promise<boolean> {
        // @todo: Delete from `oauth_pending_requests` database
        console.log('revokeAuthorizationCode()')

        return true
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

}

const privateKey = CONFIG.verida.serverKey
const network = <Network> CONFIG.verida.environment
const server = new VeridaOAuthServer(privateKey, network)

export default server