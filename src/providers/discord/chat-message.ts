import { Client, GatewayIntentBits, DMChannel } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import CONFIG from '../../config';
import {
    SyncResponse,
    SyncHandlerStatus,
    ProviderHandlerOption,
    ConnectionOptionType,
    SyncHandlerPosition,
} from '../../interfaces';
import {
    SchemaChatMessageType,
    SchemaSocialChatGroup,
    SchemaSocialChatMessage,
} from '../../schemas';
import { DiscordHandlerConfig } from './interfaces';
import BaseSyncHandler from '../BaseSyncHandler';
import { ItemsRangeTracker } from '../../helpers/itemsRangeTracker';
import { ItemsRange } from '../../helpers/interfaces';

export default class DiscordChatMessageHandler extends BaseSyncHandler {
    protected config: DiscordHandlerConfig;

    public getName(): string {
        return 'chat-message';
    }

    public getLabel(): string {
        return 'Chat Messages';
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.CHAT_MESSAGE;
    }

    public getProviderApplicationUrl(): string {
        return 'https://discord.com/';
    }

    public getOptions(): ProviderHandlerOption[] {
        return [
            {
                id: 'channelTypes',
                label: 'Channel types',
                type: ConnectionOptionType.ENUM_MULTI,
                enumOptions: [
                    { label: 'Direct Messages', value: 'DM' },
                ],
                defaultValue: 'DM',
            },
        ];
    }

    public getDiscordClient(): Client {
        const token = this.connection.accessToken;

        const client = new Client({
            intents: [
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.Guilds,
                GatewayIntentBits.MessageContent,
            ],
        });

        client.login(token);
        return client;
    }

    protected async buildChatGroupList(api: any): Promise<SchemaSocialChatGroup[]> {
        let channelList: SchemaSocialChatGroup[] = [];
//let dmChannels: any[] = [];

        try {
            // const client = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(this.connection.accessToken);
            // const channels = await client.get('/users/@me/guilds');
            // Fetch DM channels only
            // dmChannels = await api.post(Routes.userChannels());
            const client = this.getDiscordClient();

            // Wait until the client is ready to ensure all channels are accessible
            await new Promise(resolve => client.once('ready', resolve));

            const dmChannels = client.channels.cache.filter(
                channel => channel.isDMBased()
            ) as Map<string, DMChannel>;
            console.log('DM Channels===========:');
            console.log(dmChannels)

        } catch (error) {
            console.error('Error fetching DM channels:', error);
            return [];
        }
/*
        for (const channel of dmChannels) {
            if (channel.isDMBased()) {
                const dmChannel = channel as DMChannel;
                const group: SchemaSocialChatGroup = {
                    _id: this.buildItemId(dmChannel.id),
                    name: `DM with ${dmChannel.recipient?.username}`,
                    sourceAccountId: this.provider.getAccountId(),
                    sourceApplication: this.getProviderApplicationUrl(),
                    sourceId: dmChannel.id,
                    schema: CONFIG.verida.schemas.CHAT_GROUP,
                    sourceData: dmChannel,
                    insertedAt: new Date().toISOString(),
                };
                channelList.push(group);
            }
        }*/

        return channelList;
    }

    protected async fetchMessageRange(
        chatGroup: SchemaSocialChatGroup,
        range: ItemsRange,
        apiClient: Client
    ): Promise<SchemaSocialChatMessage[]> {
        const messages: SchemaSocialChatMessage[] = [];
        const channel = apiClient.channels.cache.get(chatGroup.sourceId!) as DMChannel;

        if (!channel) return messages;

        const fetchedMessages = await channel.messages.fetch({
            after: range.startId,
            before: range.endId,
        });

        for (const message of fetchedMessages.values()) {
            const chatMessage: SchemaSocialChatMessage = {
                _id: this.buildItemId(message.id),
                groupId: chatGroup._id,
                groupName: chatGroup.name,
                messageText: message.content,
                fromHandle: message.author.username,
                sourceAccountId: this.provider.getAccountId(),
                sourceApplication: this.getProviderApplicationUrl(),
                sourceId: message.id,
                sourceData: message,
                insertedAt: new Date(message.createdTimestamp).toISOString(),
                sentAt: new Date(message.createdTimestamp).toISOString(),
                type:
                    message.author.id === this.connection.profile.id
                        ? SchemaChatMessageType.SEND
                        : SchemaChatMessageType.RECEIVE,
                fromId: message.author.id,
                name: message.content.substring(0, 30),
            };
            messages.push(chatMessage);
        }

        return messages;
    }

    public async _sync(
        api: any,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        try {
            const groupList = await this.buildChatGroupList(api);

            let totalMessages = 0;
            let chatHistory: SchemaSocialChatMessage[] = [];

            const groupCount = groupList.length;

            for (const group of groupList) {

                let rangeTracker = new ItemsRangeTracker(group.syncData);

                const fetchedMessages = await this.fetchAndTrackMessages(
                    group,
                    rangeTracker,
                    api
                );

                chatHistory = chatHistory.concat(fetchedMessages);
                totalMessages += fetchedMessages.length;

                group.syncData = rangeTracker.export();
            }

            this.updateSyncPosition(
                syncPosition,
                totalMessages
            );

            return {
                results: groupList.concat(chatHistory),
                position: syncPosition,
            };
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }

    private async fetchAndTrackMessages(
        group: SchemaSocialChatGroup,
        rangeTracker: ItemsRangeTracker,
        apiClient: any
    ): Promise<SchemaSocialChatMessage[]> {
        // Validate group and group.id
        if (!group || !group.sourceId) {
            throw new Error('Invalid group or missing group sourceId');
        }

        // Initialize range from tracker
        let currentRange = rangeTracker.nextRange();
        let items: SchemaSocialChatMessage[] = [];

        while (true) {
            // Fetch messages for the current range using fetchMessageRange
            const messages = await this.fetchMessageRange(group, currentRange, apiClient);

            if (!messages.length) break;

            // Add fetched messages to the main list
            items = items.concat(messages);

            // Break loop if messages reached group limit
            if (items.length > this.config.messagesPerChannelLimit) {
                // Mark the current range as complete and stop
                rangeTracker.completedRange({
                    startId: messages[0].sourceId,
                    endId: messages[messages.length - 1].sourceId,
                }, false);
                break;
            } else {
                // Update rangeTracker and continue fetching
                rangeTracker.completedRange({
                    startId: messages[0].sourceId,
                    endId: messages[messages.length - 1].sourceId,
                }, false);

                // Move to the next range
                currentRange = rangeTracker.nextRange();
            }
        }

        return items;
    }

    private updateSyncPosition(
        syncPosition: SyncHandlerPosition,
        totalMessages: number
    ) {
        if (totalMessages === 0) {
            syncPosition.status = SyncHandlerStatus.ENABLED;
            syncPosition.syncMessage = 'No new messages found.';
        } else {
            syncPosition.syncMessage = `Batch complete (${totalMessages}). More results pending.`;
        }
    }

}
