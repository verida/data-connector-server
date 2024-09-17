import { WebClient } from '@slack/web-api';
import * as fs from 'fs';
import * as path from 'path';
import CONFIG from '../../config';

const slackPathPrefix = `_slack`;

export class SlackApi {
    clientId: string;
    slackPath: string;
    client?: WebClient;

    public async getClient(): Promise<WebClient> {
        if (this.client) {
            return this.client;
        }

        if (!CONFIG.providers.slack.botToken) {
            throw new Error('Slack bot token is missing from configuration.');
        }

        const client = new WebClient(CONFIG.providers.slack.botToken);
        this.client = client;

        return this.client;
    }

    public async getConversations(limit: number = 500): Promise<string[]> {
        const client = await this.getClient();
        const channelIds: string[] = [];
        let cursor: string | undefined;

        do {
            const response = await client.conversations.list({
                limit,
                cursor,
            });

            if (!response.channels || response.channels.length === 0) {
                break;
            }

            response.channels.forEach(channel => {
                if (channel.id) {
                    channelIds.push(channel.id);
                }
            });

            cursor = response.response_metadata?.next_cursor;
        } while (cursor && channelIds.length < limit);

        return channelIds;
    }

    public async getConversation(conversationId: string): Promise<any> {
        const client = await this.getClient();
        const conversation = await client.conversations.info({
            channel: conversationId,
        });

        return conversation;
    }

    public async getUser(userId: string): Promise<any> {
        const client = await this.getClient();
        const user = await client.users.info({ user: userId });

        return user;
    }

    public async getMessage(channelId: string, messageId: string): Promise<any> {
        const client = await this.getClient();
        const message = await client.conversations.history({
            channel: channelId,
            inclusive: true,
            latest: messageId,
            limit: 1,
        });

        if (!message.messages || message.messages.length === 0) {
            throw new Error('Message not found.');
        }

        return message.messages[0];
    }

    public async getConversationHistory(
        channelId: string,
        limit: number = 100,
        latest?: string
    ): Promise<any[]> {
        const client = await this.getClient();
        const messages: any[] = [];

        let cursor: string | undefined;
        do {
            const response = await client.conversations.history({
                channel: channelId,
                limit,
                cursor,
                latest,
            });

            if (!response.messages || response.messages.length === 0) {
                break;
            }

            messages.push(...response.messages);

            cursor = response.response_metadata?.next_cursor;
        } while (cursor && messages.length < limit);

        return messages;
    }
}
