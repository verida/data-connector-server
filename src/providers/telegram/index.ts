import { Request, Response } from 'express'
import Base from "../BaseProvider"

import { BaseProviderConfig } from '../../interfaces'

export interface TelegramProviderConfig extends BaseProviderConfig {
    apiId: number
    apiHash: string
}

/**
 * A fake provider used for testing purposes
 */
export default class TelegramProvider extends Base {

    protected config: TelegramProviderConfig

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
        return {
            id: 1,
            accessToken: 'fake-access-token',
            refreshToken: 'fake-refresh-token',
            profile: {
                id: 1,
                name: 'Fake user'
            }
        }
    }

    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        return
    }

}

