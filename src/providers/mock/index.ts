import { Request, Response } from 'express'
import Base from "../BaseProvider"

import Post from './post'
import { BaseProviderConfig } from '../../interfaces'

export interface MockProviderConfig extends BaseProviderConfig {
    limit: number
}

/**
 * A fake provider used for testing purposes
 */
export default class MockProvider extends Base {

    protected config: MockProviderConfig

    public getProviderId() {
        return 'mock'
    }

    public getProviderLabel() {
        return 'Mock'
    }

    public getProviderApplicationUrl() {
        return 'https://mock.com/'
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

