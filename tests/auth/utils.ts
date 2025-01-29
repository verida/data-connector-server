import Axios from "axios"
import https from 'https';
import { AutoAccount } from "@verida/account-node";
import { Client } from "@verida/client-ts";
import { AuthTypeConfig, ContextSession, VeridaDatabaseAuthContext } from "@verida/types"
import CONFIG from "../../src/config"
import { AuthRequest } from "../../src/api/rest/v1/auth/interfaces";
import StorageEngineVerida from '@verida/client-ts/dist/src/context/engines/verida/database/engine'
import { BillingAccountType } from "../../src/services/billing/interfaces";

const VERIDA_CONTEXT = 'Verida: Vault'
const NOW = Math.floor(Date.now() / 1000)
const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1/auth`
const APP_REDIRECT_URI = "https://insertyourdomain.com/verida/auth-response"

export const userAccount = new AutoAccount({
    privateKey: CONFIG.verida.testVeridaKey,
    network: CONFIG.verida.testVeridaNetwork,
    didClientConfig: CONFIG.verida.didClientConfig
})

export const appAccount = new AutoAccount({
    privateKey: CONFIG.verida.testServerKey,
    network: CONFIG.verida.testVeridaNetwork,
    didClientConfig: CONFIG.verida.didClientConfig
})

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
});

export async function buildContextSession(account: AutoAccount, client: Client, contextName: string): Promise<ContextSession> {
    const context = await client.openContext(contextName, true)
    const contextConfig = await context?.getContextConfig()

    const keyring = await account.keyring(contextName)
    const signature = keyring.getSeed()

    // If we have a legacy DID, opening the context will change the DID from polpos to mainnet
    // and ensure there is no issues with the session context having a DID that doesn't
    // match the DID on the storage nodes (can cause issues when creating a database)
    const did = await account.did()

    // Get a context auth object and force create so we get a new refresh token
    const dbEngine = await context?.getDatabaseEngine(did!, true)
    const endpoints = (dbEngine as StorageEngineVerida).getEndpoints()
    const deviceId = `Unit Test`

    const contextAuths: Record<string, VeridaDatabaseAuthContext | undefined> = {}
    for (const endpointUri in endpoints) {
        const contextAuth = await context?.getAuthContext({
            force: true,
            endpointUri: endpointUri,
            deviceId,
        } as AuthTypeConfig)
            contextAuths[endpointUri] = <VeridaDatabaseAuthContext> contextAuth
    }

    // Close the context so it's not open on disk to prevent conflict with the server when it opens the context
    await context?.close()

    return {
        signature,
        did,
        contextConfig: contextConfig!,
        contextAuths,
        contextName,
    }

}

export async function resolveScopes(ENDPOINT, scopes: string[]) {
    const endpoint = new URL(`${ENDPOINT}/resolve-scopes`)
    for (const scope of scopes) {
        endpoint.searchParams.append('scopes', scope)
    }

    return await axios.get(`${endpoint.toString()}`)
}

export async function buildSessionToken(account: AutoAccount, client: Client, contextName: string = VERIDA_CONTEXT) {
    const contextSession = await buildContextSession(account, client, contextName)
    const stringifiedSession = JSON.stringify(contextSession)
    return Buffer.from(stringifiedSession).toString("base64")
}

export function buildClient() {
    return new Client({
        network: CONFIG.verida.testVeridaNetwork,
        didClientConfig: CONFIG.verida.didClientConfig
    })
}

export async function authenticate(scopes: string[]): Promise<{
    authCode: string,
    USER_DID: string,
    APP_DID: string,
    sessionToken: string
}> {
    const client = buildClient()
    
    await client.connect(userAccount)

    // Build a context session object, this would normally be done in the user's web browser
    // once they have logged in
    const sessionToken = await buildSessionToken(userAccount, client)

    const USER_DID = await userAccount.did()
    const APP_DID = await appAccount.did()

    const ARO: AuthRequest = {
        appDID: APP_DID,
        userDID: USER_DID,
        scopes,
        timestamp: NOW,
        payer: BillingAccountType.APP
    }

    const authRequest = JSON.stringify(ARO)

    // Sign the ARO to generate a consent signature verifying the user account consents to this request
    const userKeyring = await userAccount.keyring(VERIDA_CONTEXT)
    const user_sig = await userKeyring.sign(authRequest)

    // Add custom state data that will be passed back to the third party application on successful login
    const state = {}

    const request = {
        client_id: APP_DID,
        auth_request: authRequest,
        redirect_uri: APP_REDIRECT_URI,
        user_sig,
        // app_sig,
        state: JSON.stringify(state)
    }

    const response = await axios.post(`${ENDPOINT}/auth`, request, {
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": sessionToken
        }
    })

    const redirectUrl = response.data.redirectUrl
    const parsedUrl = new URL(redirectUrl)
    let authCode = parsedUrl.searchParams.get("auth_token")
    authCode = decodeURIComponent(authCode!)

    return {
        authCode,
        USER_DID,
        APP_DID,
        sessionToken
    }
}

export async function revokeToken(authCode: string, sessionToken: string) {
    if (!authCode) {
        return
    }

    try {
        const tokenId = authCode.substring(0,36)
        await axios.get(`${ENDPOINT}/revoke?tokenId=${tokenId}`, {
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": sessionToken
            },
        })
    } catch (err) {
        if (err.response?.data?.error?.match('Invalid token')) {
            // Token already revoked, so all good
            return
        }

        console.error('Unknown revoke error:', err.message)
        console.log(err.response.data)
    }
}