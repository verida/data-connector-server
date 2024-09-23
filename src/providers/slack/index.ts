import { Request, Response } from "express";
import Base from "../BaseProvider";
import { SlackProviderConfig } from "./interfaces";
import { FileInstallationStore, InstallProvider } from '@slack/oauth';
import { WebClient } from "@slack/web-api";
import SlackChatMessageHandler from "./chat-message";
const axios = require('axios');

import { Installation, InstallationStore, InstallationQuery } from '@slack/oauth';
import { PassportProfile } from "../../interfaces";
import { SlackHelpers } from "./helpers";
export class CustomInstallationStore implements InstallationStore {
    private installations: Map<string, Installation> = new Map();

    // Save the installation data
    public async storeInstallation(installation: Installation): Promise<void> {
        const teamId = installation.team?.id ?? installation.enterprise?.id;
        if (!teamId) {
            throw new Error('Failed to identify team or enterprise in installation');
        }
        this.installations.set(teamId, installation);
    }

    // Fetch the installation data
    public async fetchInstallation(query: InstallationQuery<boolean>): Promise<Installation> {
        const teamId = query.teamId ?? query.enterpriseId;
        if (!teamId || !this.installations.has(teamId)) {
            throw new Error('Installation not found');
        }
        return this.installations.get(teamId)!; // Return the installation
    }

    // Delete the installation data (if needed)
    public async deleteInstallation(query: InstallationQuery<boolean>): Promise<void> {
        const teamId = query.teamId ?? query.enterpriseId;
        if (teamId) {
            this.installations.delete(teamId);
        }
    }
}

export default class SlackProvider extends Base {
    protected config: SlackProviderConfig;
    protected slackInstaller: InstallProvider;
    protected installationStore: CustomInstallationStore = new CustomInstallationStore();

    public init() {
        this.slackInstaller = new InstallProvider({
            clientId: this.config.clientId,
            clientSecret: this.config.clientSecret,
            authVersion: 'v2',
            stateSecret: this.config.stateSecret, // Use the stateSecret for additional security
            installationStore: this.installationStore
        });
    }

    public getProviderName() {
        return "slack";
    }

    public getProviderLabel() {
        return "Slack";
    }

    public getProviderApplicationUrl() {
        return "https://slack.com/";
    }

    public syncHandlers(): any[] {
        return [
            SlackChatMessageHandler,
        ];
    }

    public getScopes(): string[] {
        return [
            "channels:read",
            "groups:read",
            "im:read",
            "mpim:read",
            "users:read",
            "users:read.email",
            "channels:history",
            "groups:history",
            "im:history",
            "mpim:history"
        ];
    }

    public getUserScopes(): string[] {
        return [
            "channels:read",
            "groups:read",
            "im:read",
            "mpim:read",
            "users:read",
            "users:read.email",
            "channels:history",
            "groups:history",
            "im:history",
            "mpim:history"
        ];
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init();
        try {

            await this.slackInstaller.handleInstallPath(
                req,
                res,
                {},
                {
                    scopes: this.getScopes(),
                    userScopes: this.getUserScopes(),
                });

        } catch (error) {
            next(error);
        }
    }
    public async getAccessToken(code: string) {
        const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code: code,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data;
    }


    public async callback(req: Request, res: Response, next: any): Promise<any> {
        this.init();
        const { code } = req.query;
        try {
            const data = await this.getAccessToken(code as string);

            // Fetch the user's profile from Slack using the `authed_user.access_token`
            const userInfo = await SlackHelpers.getUserInfo(data.authed_user.access_token, data.authed_user.id);

            // Build the PassportProfile object
            const profile: PassportProfile = {
                id: userInfo.id,  // Slack user ID
                provider: this.getProviderName(),  // Set your Slack provider name
                displayName: userInfo.profile.real_name,  // User's real name
                name: {
                    familyName: userInfo.profile.first_name,  
                    givenName: userInfo.profile.last_name
                },
                connectionProfile: {
                    username: userInfo.profile.display_name,  // Display name as username
                    email: userInfo.profile.email,  // Email from profile
                    phone: userInfo.profile.phone,  
                    verified: userInfo.is_email_confirmed
                }
            };

            // Add access token data
            const connectionToken = {
                id: data.team.id,
                accessToken: data.authed_user.access_token,
                refreshToken: data.refresh_token,  // If applicable, otherwise remove
                profile: profile
            };

            return connectionToken;

        } catch (error) {
            next(error);
        }
    }


    public async getApi(accessToken?: string, refreshToken?: string): Promise<WebClient> {
        if (!accessToken) {
            throw new Error('Access token is required');
        }

        // Create a new WebClient instance with the provided access token
        const client = new WebClient(accessToken);

        return client;
    }
}
