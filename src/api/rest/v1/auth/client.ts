import { getResolver } from '@verida/vda-did-resolver';
import { DIDDocument } from '@verida/did-document';
import { Resolver } from 'did-resolver';
import { VeridaDocInterface, IContext, Network } from '@verida/types';
import { AuthRequest } from "./interfaces"
import CONFIG from "../../../../config"
import { BillingAccountType } from '../../../../services/billing/interfaces';

const vdaDidResolver = getResolver()
const didResolver = new Resolver(vdaDidResolver)

const VAULT_CONTEXT_NAME = `Verida: Vault`

const PAYER_TYPES = [
    BillingAccountType.APP,
    BillingAccountType.USER
]

export class AuthClient {
    protected did: string
    protected didDocument?: DIDDocument

    public redirectUris?: string[]
    public grants: string[] = ["authorization_code", "refresh_token"]
    public accessTokenLifetime: number = 3600
    public refreshTokenLifetime?: number = undefined


    constructor(did: string) {
        this.did = did
    }

    // Client object must have `id` property
    public get id() {
        return this.did
    }

    public async verifyRequest(context: IContext, redirectUrl: string, authRequestString: string, userSig: string): Promise<AuthRequest> {
        await this.init()
        const account = context.getAccount()
        const signerDid = await account.did()
        const userKeyring = await account.keyring(VAULT_CONTEXT_NAME)

        const authRequest: AuthRequest = JSON.parse(authRequestString)
        // Ensure `revoke-tokens` scope is never set
        if (authRequest.scopes && authRequest.scopes.length) {
            authRequest.scopes = authRequest.scopes.filter(str => str !== 'access-tokens')
        }

        // Verify the authRequest is signed by the user
        const isValidUserSig = await userKeyring.verifySig(authRequestString, userSig)
        if (!isValidUserSig) {
            throw new Error(`Invalid user account signature on the auth request`)
        }

        if (authRequest.userDID != signerDid) {
            throw new Error(`Invalid user account signer on the auth request`)
        }

        if ([BillingAccountType.APP, BillingAccountType.USER].indexOf(authRequest.payer) === -1) {
            throw new Error(`Invalid payer (${authRequest.payer}) or mis-match with auth request`)
        }

        // Get third party application DID Document
        // if (authRequest.appDID) {
        //     const response = await didResolver.resolve(authRequest.appDID)
        //     const appDidDocument = new DIDDocument(<VeridaDocInterface> response.didDocument!)

        //     // @todo: Verify DIDDocument has serviceEndpoint of type `VeridaOAuthServer` that matches redirectUrl
        //     const didDoc = appDidDocument.export()
        //     // console.log(didDoc)
        //     let serverFound = false
        //     for (const service of didDoc.service) {
        //         // console.log(service)
        //     }
        // }

        // Verify clientSecret timestamp is within minutes of current timestamp
        const timeoutMins = CONFIG.verida.OAuthRequestTimeoutMins
        const timeoutMs = timeoutMins * 60 * 1000; // 2 minutes in milliseconds

        const timestampMs = authRequest.timestamp * 1000
        const now = Date.now(); // Current timestamp in milliseconds
        const cutoff = now - timeoutMs

        if (timestampMs < cutoff) {
            throw new Error(`Auth request has expired (${(now - timestampMs) / 1000.0} seconds old > ${timeoutMins})`)
        }

        return authRequest
    }

    public async init() {
        if (this.didDocument) {
            return
        }

        const response = await didResolver.resolve(this.did)
        this.didDocument = new DIDDocument(<VeridaDocInterface> response.didDocument!)
    }

}