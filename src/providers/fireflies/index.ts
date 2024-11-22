import { Request, Response } from 'express'
import Base from "../BaseProvider"

import { BaseProviderConfig, ConnectionCallbackResponse, PassportProfile } from '../../interfaces'
import { FireFliesClient, FireFliesConfig } from './api'
import MeetingTranscriptHandler from './meeting-transcript'

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
        return [
            MeetingTranscriptHandler
        ]
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        return res.redirect('/provider/fireflies')
    }

    public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
        const apiKey = req.query.apiKey!.toString();

        // Initialize Fireflies client configuration
        const config: FireFliesConfig = {
            apiKey: apiKey
        };

        const client = new FireFliesClient(config);

        // Fetch user profile from Fireflies
        const ffProfile = await client.getUser();

        // Set up display name
        const displayName = ffProfile.name.trim();

        // Construct the profile structure similar to the Telegram format
        const profile: PassportProfile = {
            id: ffProfile.user_id.toString(),
            provider: this.getProviderId(), // Assuming getProviderId() returns 'fireflies' or similar identifier
            displayName: displayName,
            name: {
                familyName: ffProfile.name.split(" ").slice(-1)[0], // Last word as family name
                givenName: ffProfile.name.split(" ").slice(0, -1).join(" ") // First part as given name
            },
            connectionProfile: {
                username: ffProfile.email.split('@')[0], // Username from email prefix
                readableId: ffProfile.user_id,
                email: ffProfile.email,
                verified: true // Assuming profile is verified
            }
        };

        return {
            id: profile.id,
            accessToken: apiKey,
            refreshToken: apiKey,
            profile
        };
    }

    public async getApi(
        accessToken?: string,
        refreshToken?: string
    ): Promise<any> { }
}

