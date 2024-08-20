import { AccountNodeDIDClientConfig, IContext, Network } from "@verida/types";
import { Client } from "@verida/client-ts"
import { AutoAccount } from "@verida/account-node"
import { Request } from "express";

export interface NetworkConnection {
    client: Client,
    context: IContext,
    account: AutoAccount
}

// @todo: env variables
const VAULT_CONTEXT_NAME = 'Verida: Vault'
const VERIDA_ENVIRONMENT = <Network> process.env.VERIDA_NETWORK
const DID_CLIENT_CONFIG: AccountNodeDIDClientConfig = {
    callType: "web3",
    web3Config: {
        privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY
    }
}

export default class Common {

    // key = did
    protected static networkCache: Record<string, NetworkConnection> = {}

    // public static async getNetworkFromRequest(req: Request): Promise<NetworkConnection> {
    //     const headers = req.headers
    //     const key = headers["key"] ? headers["key"].toString() : req.query.key.toString()
    //     const contextName = headers["context-name"] ? headers["context-name"].toString() : VAULT_CONTEXT_NAME

    //     console.log(key, contextName)

    //     return Common.getNetwork(key, contextName)
    // }

    // public static buildPermissions(req: Request) {
    //     const permissionsHeader = req.headers['permissions'] ? req.headers['permissions'].toString().toLowerCase() : 'write=owner,read=owner'
    //     const permissions: Record<string,string> = {}
    //     const permissionEntries = permissionsHeader.split(',')
    //     permissionEntries.forEach(item => {
    //         const splitResults = item.split('=')
    //         const permission = splitResults[0]
    //         const userType = splitResults[1]
    //         permissions[permission] = userType
    //     })

    //     return permissions
    // }

    // public static getSchemaFromParams(base64Schema: string) {
    //     const buffer = Buffer.from(base64Schema, 'base64')
    //     return buffer.toString('utf-8')
    // }

    // private static async getNetwork(signature: string, contextName: string): Promise<{
    //     client: Client,
    //     context: IContext,
    //     account: AutoAccount
    // }> {
    //     console.log(VERIDA_ENVIRONMENT, DID_CLIENT_CONFIG)
    //     // @todo: Switch to context account once context storage node issue fixed and deployed
    //     //const account = new ContextAccount({
    //     const account = new AutoAccount({
    //         privateKey: signature,
    //         network: VERIDA_ENVIRONMENT,
    //         // @ts-ignore
    //         didClientConfig: DID_CLIENT_CONFIG
    //     })
    //     const did = (await account.did()).toLowerCase()
        
    //     if (this.networkCache[did]) {
    //         console.log(`Loaded network from cache! (${did})`)
    //         return Common.networkCache[did]
    //     }

    //     const client = new Client({
    //         network: VERIDA_ENVIRONMENT
    //     })

    //     await client.connect(account)
    //     const context = await client.openContext(contextName)

    //     // @todo: Manage cache size
    //     this.networkCache[did] = {
    //         client,
    //         context,
    //         account
    //     }

    //     return Common.networkCache[did]
    // }

}