import { Request, Response } from 'express'
import BaseProviderConfig from './BaseProviderConfig'

export interface AccountAuth {
    accessToken: string,
    refreshToken: string
}

export default class BaseProvider {

    protected icon?: string
    protected config: BaseProviderConfig
    protected newAuth?: AccountAuth

    public constructor(config: BaseProviderConfig) {
        this.config = config
    }

    public getLabel() {
        return this.config.label
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public async syncFromRequest(req: Request, res: Response, next: any): Promise<any> {
        const query = req.query
        const accessToken = query.accessToken ? query.accessToken.toString() : ''
        const refreshToken = query.refreshToken ? query.refreshToken.toString() : ''

        return this.sync(accessToken, refreshToken)
    }

    public async sync(accessToken: string, refreshToken: string, schemaUri?: string): Promise<any> {
        const api = await this.getApi(accessToken, refreshToken)
        const results = []

        const handlers = this.syncHandlers()
        for (let h in handlers) {
            const handler = handlers[h]

            if (schemaUri && handler.getSchemaUri() != schemaUri) {
                continue
            }
            
            const handlerInstance = new handler(this.config)
            const handlerResults = await handlerInstance.sync(api)
            results[handler.getSchemaUri()] = handlerResults
        }

        return results
    }

    // Set new authentication credentials for this provider instance, if they changed
    protected setAccountAuth(accessToken: string, refreshToken: string) {
        this.newAuth = {
            accessToken,
            refreshToken
        }
    }

    public getAccountAuth(): AccountAuth {
        return this.newAuth
    }

    /**
     * Generate an api connection instance for communicating with this provider.
     * 
     * Must be implemented for each provider
     * @param req 
     */
    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        throw new Error('Not implemented')
    }

    /**
     * Override this with a list of sync handlers supported by this provider.
     * 
     * Each sync handler must be a class extending from `BaseSyncHandler`
     * 
     * @returns 
     */
    public syncHandlers(): any[] {
        return []
    }

    public schemaUris(): string[] {
        const handlers = this.syncHandlers()
        const uris: string[] = []
        
        handlers.forEach((handler: any) => {
            uris.push(handler.getSchemaUri())
        })

        return uris
    }
}