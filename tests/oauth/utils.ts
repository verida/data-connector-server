import { AutoAccount } from "@verida/account-node";
import { Client } from "@verida/client-ts";
import { AuthTypeConfig, ContextSession, VeridaDatabaseAuthContext } from "@verida/types"
import StorageEngineVerida from '@verida/client-ts/dist/src/context/engines/verida/database/engine'

export async function buildContextSession(account: AutoAccount, client: Client): Promise<ContextSession> {
    const CONTEXT = 'Verida: Vault'
    const keyring = await account.keyring(CONTEXT)
    const signature = keyring.getSeed()
    const did = await account.did()

    const context = await client.openContext(CONTEXT, true)
    const contextConfig = await context?.getContextConfig()

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

    return {
        signature,
        did,
        contextConfig: contextConfig!,
        contextAuths,
        contextName: CONTEXT,
    }

}