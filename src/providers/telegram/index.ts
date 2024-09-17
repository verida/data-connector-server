import { Request, Response } from 'express'
import Base from "../BaseProvider"

import { BaseProviderConfig, ConnectionProfile, PassportPhoto, PassportProfile } from '../../interfaces'
import { TelegramApi } from './api'
import TelegramChatMessageHandler from './chat-message'

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

    public syncHandlers(): any[] {
        return [
            TelegramChatMessageHandler
        ]
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        return res.redirect('/provider/telegram')
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        console.log('callback')
        const clientId = req.query.id!.toString()

        const api = new TelegramApi(clientId)
        const client = await api.getClient(true)

        // @todo: get profile
        const tgProfile = await client.api.getMe({})
        console.log('telegram profile', tgProfile)

        const username = tgProfile.usernames && tgProfile.usernames.active_usernames ? tgProfile.usernames.active_usernames[0] : undefined
        const displayName = `${tgProfile.first_name} ${tgProfile.last_name}`.trim()

        const profile: PassportProfile = {
            id: tgProfile.id.toString(),
            provider: this.getProviderName(),
            displayName: displayName,
            name: {
                familyName: tgProfile.last_name,
                givenName: tgProfile.first_name
            },
            connectionProfile: {
                username,
                readableId: username ? username : `${displayName} (${tgProfile.id.toString()})`,
                phone: tgProfile.phone_number,
                verified: tgProfile.is_verified
            }
        }

        if (tgProfile.profile_photo && tgProfile.profile_photo.small) {
            const photo = await api.downloadFile(tgProfile.profile_photo.small.id)

            profile.photos = [{
                value: `data:image/jpeg;base64,` + photo
            }]
        }

        // close API connection
        console.log('close connection')
        const binFile = await api.closeClient()

        // get bin file and sae it in the refresh token)

        return {
            id: profile.id,
            accessToken: clientId,
            refreshToken: binFile,
            profile
        }
    }

    public async getApi(accessToken?: string, refreshToken?: string): Promise<TelegramApi> {
        console.log('get telegram api')
        if (this.api) {
            console.log('returning api from cache')
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

        await api.getClient(true)
        this.api = api
        return api
    }

    public async close() {
        console.log('telegram close')
        const api = await this.getApi()
        console.log('close client')
        const binFile = await api.closeClient()

        this.connection!.refreshToken = binFile
    }

}

