
export default class BaseSyncHandler {

    protected static schemaUri: string
    protected config: any

    constructor(config: any) {
        this.config = config
    }

    protected static getSchemaUri(): string {
        return this.schemaUri
    }

    /**
     * Implement this sync method to generate data for the schemaUri of this sync handler
     */
    public async sync(api: any): Promise <any> {
        throw new Error('Not implemented')
    }

}