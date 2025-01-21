import { DatabasePermissionOptionsEnum, IContext, IDatabase } from "@verida/types"
import { AuthToken } from "./interfaces"

const DB_PUBLIC_TOKENS = "api_keys"
const DB_PRIVATE_TOKENS = "api_keys_private"

export class AuthUser {

    protected context: IContext
    protected publicKeyDb: IDatabase
    protected privateKeyDb: IDatabase

    constructor(context: IContext) {
        this.context = context
    }

    public async saveAuthToken(authToken: AuthToken): Promise<void> {
        await this._init()

        const publicUserKeyData = {
            _id: authToken._id,
            servers: authToken.servers
        }

        await this.publicKeyDb.save(publicUserKeyData)
        await this.privateKeyDb.save(authToken)
    }

    public async deleteAuthToken(tokenId: string): Promise<void> {
        await this._init()

        await this.publicKeyDb.delete(tokenId)
        await this.privateKeyDb.delete(tokenId)
    }

    public async getAuthTokens(): Promise<AuthToken[]> {
        await this._init()

        const results = <any[]> await this.privateKeyDb.getMany({}, {
            limit: 1000
        })

        const authTokens: AuthToken[] = results.map(({ modifiedAt, signatures, _rev, ...rest }) => rest);
        return authTokens
    }

    public async getAuthToken(tokenId: string): Promise<AuthToken> {
        await this._init()

        const result: any = await this.privateKeyDb.get(tokenId)
        const { modifiedAt, signatures, _rev, ...rest } = result

        return <AuthToken> rest
    }

    public async _init(): Promise<void> {
        if (this.publicKeyDb) {
            return
        }

        this.publicKeyDb = await this.context.openDatabase(DB_PUBLIC_TOKENS, {
            permissions: {
                read: DatabasePermissionOptionsEnum.PUBLIC,
                write: DatabasePermissionOptionsEnum.OWNER
            }
        })

        this.privateKeyDb = await this.context.openDatabase(DB_PRIVATE_TOKENS)
    }

}