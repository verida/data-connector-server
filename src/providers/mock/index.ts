import { Request, Response } from 'express'
import Base from "../BaseProvider"

import Post from './post'
import { BaseProviderConfig, ConnectionCallbackResponse } from '../../interfaces'

export interface MockProviderConfig extends BaseProviderConfig {
    limit: number
}

/**
 * A fake provider used for testing purposes
 */
export default class MockProvider extends Base {

    protected config: MockProviderConfig

    public getProviderName() {
        return 'mock'
    }

    public getProviderLabel() {
        return 'Mock'
    }

    public getProviderApplicationUrl() {
        return 'https://mock.com/'
    }

    public getProviderId(): string {
        return "1"
    }

    public setConfig(config: MockProviderConfig) {
        this.config = config
    }

    public syncHandlers(): any[] {
        return [
            Post
        ]
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        return
    }

    public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
        return {
            id: "1",
            accessToken: 'fake-access-token',
            refreshToken: 'fake-refresh-token',
            profile: {
                id: "",
                provider: "mock",
                displayName: 'Fake user'
            }
        }
    }

    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        return
    }

}

