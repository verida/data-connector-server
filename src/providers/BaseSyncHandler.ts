import { SyncSchemaConfig, AccountProfile } from "../interfaces"

export default class BaseSyncHandler {

    protected static schemaUri: string
    protected config: any
    protected profile: AccountProfile

    constructor(config: any, profile: AccountProfile) {
        this.config = config
        this.profile = profile
    }

    protected static getSchemaUri(): string {
        return this.schemaUri
    }

    /**
     * Implement this sync method to generate data for the schemaUri of this sync handler
     */
    public async sync(api: any, syncConfig: SyncSchemaConfig): Promise <any> {
        throw new Error('Not implemented')
    }
}