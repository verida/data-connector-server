import { getResolver } from '@verida/vda-did-resolver';
import { DIDDocument } from '@verida/did-document';
import { Resolver } from 'did-resolver';
import { VeridaDocInterface, IContext } from '@verida/types';
import { VeridaOAuthUser } from './user';
import EncryptionUtils from '@verida/encryption-utils';

const vdaDidResolver = getResolver()
const didResolver = new Resolver(vdaDidResolver)

export interface AuthRequest {
    appDid: string
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

    public async verifyRequest(context: IContext, redirectUrl: string, authRequestString: string, userSig: string, appSig: string): Promise<AuthRequest> {
        await this.init()
        const account = context.getAccount()
        const signerDid = await account.did()

        const authRequest: AuthRequest = JSON.parse(authRequestString)

        // @todo: Verify the authRequest is signed by this.did
        console.log('Verify the authRequest is signed by this.did')
        const userSigner = await EncryptionUtils.getSigner(authRequestString, userSig)
        console.log(userSigner, signerDid, authRequest.userDid)

        // if (userSigner != signerDid || userSigner != authRequest.userDid) throw new Error('invalid user signature')

        // @todo: Verify the authRequest is signed by the requesting application
        console.log('Verify the authRequest is signed by this.did')
        const appSigner = await EncryptionUtils.getSigner(authRequestString, appSig)
        console.log(appSigner, signerDid, authRequest.appDid)
        

        // @todo: Verify DIDDocument has serviceEndpoint of type `VeridaOAuthServer` that matches redirectUrl
        
        // @todo: Verify clientSecret timestamp is within minutes of current timestamp
        // @todo: Extract the AuthRequest object

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