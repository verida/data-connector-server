import { Request, Response } from "express";
import Base from "../BaseProvider";
import { SlackProviderConfig } from "./interfaces";
import { FileInstallationStore, InstallProvider } from '@slack/oauth';
import SlackChatMessageHandler from "./chat-message";
const axios = require('axios');

import { Installation, InstallationStore, InstallationQuery } from '@slack/oauth';
import { PassportProfile } from "../../interfaces";

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
            SlackChatMessageHandler
        ];
    }

    public getScopes(): string[] {
        return [
            "channels:read",
            "groups:read",
            "users:read",
        ];
    }

    public getUserScopes(): string[] {
        return [
            "channels:read",
            "groups:read",
            "users:read",
        ];
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init();
        try {

            const result = await this.slackInstaller.handleInstallPath(
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
            
            const profile: PassportProfile = {
                id: data.authed_user.id,  // Slack user ID
                provider: this.getProviderName(),  // Set your Slack provider name
                displayName: data.team.name,  // Team name as display name
                name: {
                    familyName: '',  // Slack does not provide family name directly
                    givenName: data.team.name  // Use team name as given name (optional customization)
                },
                connectionProfile: {
                    username: data.authed_user.id,  // Slack user ID as username
                    phone: undefined,  // Slack API does not provide phone info
                    verified: true  // Assuming token authorization is verified
                }
            };
    
            // Add access token data if necessary
            const connectionToken = {
                id: data.team.id,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,  // If applicable, otherwise remove
                profile: profile
            };
    
            return connectionToken;
    
        } catch (error) {
            next(error);
        }
    }
   

    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        // You can return the Slack Web API client here using the access token
    }
}
