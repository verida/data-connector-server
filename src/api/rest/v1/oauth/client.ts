import { getResolver } from '@verida/vda-did-resolver';
import { DIDDocument } from '@verida/did-document';
import { Resolver } from 'did-resolver';
import { VeridaDocInterface } from '@verida/types';
import { VeridaOAuthUser } from './user';

const vdaDidResolver = getResolver()
const didResolver = new Resolver(vdaDidResolver)

export interface AuthRequest {
    userDid: string
    scopes: string[]
    timestamp: string
}


export interface OAuthToken {
    accessToken: string
    accessTokenExpiresAt: Date
    refreshToken: string
    refreshTokenExpiresAt: Date
    scope: string[]
    user: VeridaOAuthUser
    client: VeridaOAuthClient
}

export class VeridaOAuthClient {
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

    public async verifyRequest(redirectUrl: string, authRequest: string, consentSig: string): Promise<void> {
        // await this.init()
        // @todo: Verify DIDDocument has serviceEndpoint of type `VeridaOAuthServer` that matches redirectUrl
        // @todo: Verify the authRequest is signed by this.did
        // @todo: Verify clientSecret timestamp is within minutes of current timestamp
        // @todo: Extract the AuthRequest object
        // @todo: Ensure consentSig is a valid signature of the authRequest signed by authRequest.did

        // @todo: Throw error if any verification issue
    }

    public async init() {
        if (this.didDocument) {
            return
        }

        const response = await didResolver.resolve(this.did)
        this.didDocument = new DIDDocument(<VeridaDocInterface> response.didDocument!)
    }

}