import { Request, Response } from 'express'
import Base from "../BaseProvider"

import { BaseProviderConfig, ConnectionCallbackResponse, PassportProfile } from '../../interfaces'
import { FireFliesClient, FireFliesConfig } from './api'

export default class FireFliesProvider extends Base {

    protected config: BaseProviderConfig


    public getProviderName() {
        return 'fireflies'
    }

    public getProviderLabel() {
        return 'FireFlies'
    }

    public getProviderApplicationUrl() {
        return 'https://fireflies.ai/'
    }

    public setConfig(config: BaseProviderConfig) {
        this.config = config
    }

    public syncHandlers(): any[] {
        return []
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        return res.redirect('/provider/fireflies')
    }

    public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
        
        const apiKey = req.query.apiKey!.toString();

        const config: FireFliesConfig = {
            apiKey: apiKey
        }

        const client = new FireFliesClient(config);

        const profile = await client.getUser();

        return {
            id: "",
            accessToken: apiKey,
            refreshToken: apiKey,
            profile: {
                provider: '',
                id: '',
                displayName: ''
            }
        }
    }
}

