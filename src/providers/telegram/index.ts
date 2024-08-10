import { Request, Response } from 'express'
import Base from "../BaseProvider"

import { BaseProviderConfig, ConnectionProfile } from '../../interfaces'
import { TelegramApi } from './api'

export interface TelegramProviderConfig extends BaseProviderConfig {
    apiId: number
    apiHash: string
}

/**
 * A fake provider used for testing purposes
 */
export default class TelegramProvider extends Base {

    protected config: TelegramProviderConfig
    protected api?: TelegramApi

    public getProviderName() {
        return 'telegram'
    }

    public getProviderLabel() {
        return 'Telegram'
    }

    public getProviderApplicationUrl() {
        return 'https://telegram.org/'
    }

    // public getProviderId(): string {
    //     return "1"
    // }

    public setConfig(config: TelegramProviderConfig) {
        this.config = config
    }

    // public syncHandlers(): any[] {
    //     return [
    //         Post
    //     ]
    // }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        return res.redirect('/custom/telegram')
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        console.log('callback')
        const clientId = req.query.id!.toString()

        const api = new TelegramApi(clientId)
        const client = await api.getClient(true)

        // @todo: get profile
        const tgProfile = await client.api.getMe({})
        console.log('telegram profile', tgProfile)

        const profile: ConnectionProfile = {
            id: tgProfile.id.toString(),
            name: `${tgProfile.first_name} ${tgProfile.last_name}}`.trim(),
            givenName: tgProfile.first_name,
            familyName: tgProfile.last_name,
            username: tgProfile.usernames && tgProfile.usernames.active_usernames ? tgProfile.usernames.active_usernames[0] : undefined,
            phone: tgProfile.phone_number,
            verified: tgProfile.is_verified,
            sourceData: tgProfile
        }

        if (tgProfile.profile_photo && tgProfile.profile_photo.small) {
            console.log('photo info')
            console.log(tgProfile.profile_photo.small.local)

            // avatar: {
            //     uri: `data:${asset.mimeType};base64,` + asset.base64
            // } 
        }

        // close API connection
        await client.api.close({})

        // get bin file and sae it in the refresh token
        const binFile = api.getBinFile()

        return {
            id: profile.id,
            accessToken: clientId,
            refreshToken: binFile,
            profile
        }
    }

    public async getApi(accessToken?: string, refreshToken?: string): Promise<TelegramApi> {
        if (this.api) {
            return this.api
        }
        
        const api = new TelegramApi(accessToken ? accessToken : this.connection!.accessToken)
        if (!refreshToken) {
            refreshToken = this.connection ? this.connection.refreshToken : undefined
        }

        if (!refreshToken) {
            throw new Error(`Unable to load Telegram API, no refresh (bin file) token`)
        }

        api.restoreBinFile(refreshToken)
        this.api = api
        return api
    }

    public async close() {
        const api = await this.getApi()
        const client = await api.getClient(false)

        // close API connection
        await client.api.close({})

        // get bin file and sae it in the refresh token
        const binFile = api.getBinFile()

        console.log('setting binfile:', binFile)
        this.connection!.refreshToken = binFile
    }

}

