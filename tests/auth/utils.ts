import Axios from "axios"
import https from 'https';
import { AutoAccount } from "@verida/account-node";
import { Client } from "@verida/client-ts";
import { AuthTypeConfig, ContextSession, VeridaDatabaseAuthContext } from "@verida/types"
import StorageEngineVerida from '@verida/client-ts/dist/src/context/engines/verida/database/engine'

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
});

export async function buildContextSession(account: AutoAccount, client: Client): Promise<ContextSession> {
    const CONTEXT = 'Verida: Vault'
    const context = await client.openContext(CONTEXT, true)
    const contextConfig = await context?.getContextConfig()

    const keyring = await account.keyring(CONTEXT)
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
        contextName: CONTEXT,
    }

}

export async function resolveScopes(ENDPOINT, scopes: string[]) {
    const endpoint = new URL(`${ENDPOINT}/resolve-scopes`)
    for (const scope of scopes) {
        endpoint.searchParams.append('scopes', scope)
    }

    return await axios.get(`${endpoint.toString()}`)
}