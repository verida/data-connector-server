import { Request, Response } from 'express'
import Base from "../BaseProvider"
import BaseProviderConfig from '../BaseProviderConfig'

import Post from './post'

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

