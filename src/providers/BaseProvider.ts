import { Context } from '@verida/client-ts'
import { explodeDID } from '@verida/helpers'
import { Request, Response } from 'express'
import { Utils } from '../utils'
import BaseProviderConfig from './BaseProviderConfig'
import serverconfig from '../serverconfig.json'

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

export interface SyncSchemaConfig {
    limit?: number
    sinceId?: string
}

export default class BaseProvider {

    protected config: BaseProviderConfig
    protected newAuth?: AccountAuth
    protected profile?: AccountProfile

    public constructor(config: BaseProviderConfig) {
        this.config = config
    }

    public getProviderId(): string {
        throw new Error('Not implemented')
    }

    public getProviderImageUrl(): string {
        return `${serverconfig.assetsUrl}/${this.getProviderId()}/icon.png`
    }

    public getProviderLabel(): string {
        return this.config.label
    }

    public getProviderSbtImage(): string {
        return this.config.sbtImage
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public async getProfileData(did: string): Promise<Record<string, any>> {
        const profileLabel = this.profile.name || this.profile.username || this.profile.id
        const { address: didAddress } = explodeDID(did)

        const credentialData: Record<string, any> = {
            did,
            didAddress: didAddress.toLowerCase(),
            name: `${this.getProviderLabel()}: ${profileLabel}`,
            type: `${this.getProviderId()}-account`,
            image: this.getProviderSbtImage(),
            description: `Proof of ${this.getProviderLabel()} account ownership ${profileLabel}${profileLabel == this.profile.id ? '' : ' (' + this.profile.id+ ')'}`,
            attributes: [{
                trait_type: "accountCreated",
                value: this.profile.createdAt
            }],
            uniqueAttribute: this.profile.id,
        }

        if (this.profile.url) {
            credentialData.external_url = this.profile.url
        }

        if (this.profile.avatarUrl) {
            credentialData.attributes.push({
                trait_type: "avatarUrl",
                value: this.profile.avatarUrl
            })
        }

        return credentialData
    }

    public async getProfile(did: string, context: Context): Promise<AccountProfile> {
        if (this.profile && !this.profile.credential) {
            const profileCredentialData = await this.getProfileData(did)
            this.profile.credential = await Utils.buildCredential(profileCredentialData, context)
        }

        return this.profile
    }

    /**
     * Must update `profile` or `newAuth` if they have changed
     * 
     * @param accessToken 
     * @param refreshToken 
     * @param schemaUri 
     * @returns 
     */
    public async sync(accessToken: string, refreshToken: string, syncSchemas: Record<string, SyncSchemaConfig> = {}): Promise<any> {
        const api = await this.getApi(accessToken, refreshToken)
        const results = []

        const handlers = this.syncHandlers()
        const schemaList = Object.keys(syncSchemas)
        for (let h in handlers) {
            const handler = handlers[h]

            if (schemaList.length && schemaList.indexOf(handler.getSchemaUri()) === -1) {
                // Schema list exists, but not found
                continue
            }
            
            const handlerInstance = new handler(this.config, this.profile)
            const handlerResults = await handlerInstance.sync(api, syncSchemas[handler.getSchemaUri()])
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