import { Context } from '@verida/client-ts'
import { Request, Response } from 'express'
import { Utils } from '../utils'
import BaseProviderConfig from './BaseProviderConfig'

export interface AccountAuth {
    accessToken: string,
    refreshToken: string
}

export interface AccountProfile {
    id: string,
    name?: string
    username?: string
    description?: string
    createdAt?: string
    url?: string
    avatarUrl?: string
    credential?: string
}

export default class BaseProvider {

    protected signerContext: Context

    protected icon?: string
    protected config: BaseProviderConfig
    protected newAuth?: AccountAuth
    protected profile?: AccountProfile

    public constructor(config: BaseProviderConfig, signerContext: Context) {
        this.config = config
        this.signerContext = signerContext
    }

    public getProviderId(): string {
        throw new Error('Not implemented')
    }

    public getProviderImageUrl(): string {
        return this.icon
    }

    public getProviderLabel(): string {
        throw new Error('Not implemented')
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

    public async getProfileData(did: string): Promise<Record<string, any>> {
        const profileLabel = this.profile.name || this.profile.username || this.profile.id

        const credentialData: Record<string, any> = {
            did,
            name: `${this.getProviderLabel()}: ${profileLabel}`,
            origin: this.getProviderId(),
            type: 'account',
            image: this.getProviderImageUrl(),
            description: `Proof ${did} controls ${this.getProviderLabel()} account ${profileLabel}${profileLabel == this.profile.id ? '' : '(' + this.profile.id+ ')'}`,
            attributes: {
                accountCreated: this.profile.createdAt
            },
            uniqueAttribute: this.profile.id,
        }

        if (this.profile.url) {
            credentialData.external_url = this.profile.url
        }

        if (this.profile.avatarUrl) {
            credentialData.attributes.avatarUrl = this.profile.avatarUrl
        }

        return credentialData
    }

    public async getProfile(did: string): Promise<AccountProfile> {
        if (this.profile && !this.profile.credential) {
            const credentialData = await this.getProfileData(did)
            this.profile.credential = await Utils.buildCredential(credentialData, this.signerContext)
        }

        return this.profile
    }

    public async syncFromRequest(req: Request, res: Response, next: any): Promise<any> {
        const query = req.query
        const accessToken = query.accessToken ? query.accessToken.toString() : ''
        const refreshToken = query.refreshToken ? query.refreshToken.toString() : ''

        return this.sync(accessToken, refreshToken)
    }

    /**
     * 
     * Must update `profile` or `newAuth` if they have changed
     * 
     * @param accessToken 
     * @param refreshToken 
     * @param schemaUri 
     * @returns 
     */
    public async sync(accessToken: string, refreshToken: string, schemaUri?: string): Promise<any> {
        const api = await this.getApi(accessToken, refreshToken)
        const results = []

        const handlers = this.syncHandlers()
        for (let h in handlers) {
            const handler = handlers[h]

            if (schemaUri && handler.getSchemaUri() != schemaUri) {
                continue
            }
            
            const handlerInstance = new handler(this.config, this.profile)
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
     * Must be implemented for each provider.
     * Must populate this.profile with the most up-to-date profile information for the account
     * 
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