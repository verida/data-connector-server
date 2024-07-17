import { Request, Response } from 'express'
import Base from "../BaseProvider"
import BaseProviderConfig from '../BaseProviderConfig'

import Post from './post'

export interface FacetProviderConfig extends BaseProviderConfig {
    limit: number
}

/**
 * A fake provider used for testing purposes
 */
export default class FacetProvider extends Base {

    protected config: FacetProviderConfig

    public getProviderId() {
        return 'facet'
    }

    public getProviderLabel() {
        return 'Facet'
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

