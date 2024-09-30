import { Client, GatewayIntentBits, TextChannel, DMChannel } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import CONFIG from '../../config';
import {
    SyncItemsResult,
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
import { DiscordChatGroupType, DiscordHandlerConfig } from './interfaces';
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
                    { label: 'Text Channels', value: DiscordChatGroupType.GUILD_TEXT },
                    { label: 'Direct Messages', value: DiscordChatGroupType.DM },
                ],
                defaultValue: [
                    DiscordChatGroupType.GUILD_TEXT,
                    DiscordChatGroupType.DM,
                ].join(','),
            },
        ];
    }

    public getDiscordClient(): Client {
        
        const token = this.connection.accessToken;
        
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ],
        });
    
        client.login(token);
        return client;
    }  

    protected async buildChatGroupList(api: any): Promise<SchemaSocialChatGroup[]> {
        let channelList: SchemaSocialChatGroup[] = [];
        let channels = []
        
        try {
            const guilds: any = await api.get(Routes.userGuilds());
        
            for (const guild of guilds) {
                channels = await api.get(Routes.guildChannels(guild.id))
                
                console.log(`Channels in guild ${guild.name}:`, channels);
            }
    
        } catch (error) {
            console.error('Error fetching user guilds & channels:', error);
            return [];
        }
        
    
        for (const [id, channel] of channels) {
            if (channel.isTextBased()) {
                if (channel instanceof TextChannel) {
                    const textChannel = channel as TextChannel;
                    const group: SchemaSocialChatGroup = {
                        _id: this.buildItemId(textChannel.id),
                        name: textChannel.name,
                        sourceAccountId: this.provider.getAccountId(),
                        sourceApplication: this.getProviderApplicationUrl(),
                        sourceId: textChannel.id,
                        schema: CONFIG.verida.schemas.CHAT_GROUP,
                        sourceData: textChannel,
                        insertedAt: new Date().toISOString(),
                    };
                    channelList.push(group);
                } else if (channel.isDMBased()) {
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
            }
        }
        return channelList;
    }
    

    protected async fetchMessageRange(
        chatGroup: SchemaSocialChatGroup,
        range: ItemsRange,
        apiClient: Client
    ): Promise<SchemaSocialChatMessage[]> {
        const messages: SchemaSocialChatMessage[] = [];
        const channel = apiClient.channels.cache.get(chatGroup.sourceId!) as TextChannel | DMChannel;

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
            //const apiClient = await this.getDiscordClient();
            const groupList = await this.buildChatGroupList(api); // Fetch all Text Channels and DM groups

            let totalMessages = 0;
            let chatHistory: SchemaSocialChatMessage[] = [];

            // Determine the current group position
            let groupPosition = this.getGroupPositionIndex(groupList, syncPosition);

            const groupCount = groupList.length;

            // Iterate over each group
            for (let i = 0; i < Math.min(groupCount, this.config.channelLimit); i++) {
                const groupIndex = (groupPosition + i) % groupCount; // Rotate through groups
                const group = groupList[groupIndex];

                // Use a separate ItemsRangeTracker for each group
                let rangeTracker = new ItemsRangeTracker(group.syncData);

                const fetchedMessages = await this.fetchAndTrackMessages(
                    group,
                    rangeTracker,
                    api
                );

                // Concatenate the fetched messages to the total chat history
                chatHistory = chatHistory.concat(fetchedMessages);
                totalMessages += fetchedMessages.length;

                // Update the group's sync data with the latest rangeTracker state
                group.syncData = rangeTracker.export();

                // Stop if the total messages fetched reach the batch size
                if (totalMessages >= this.config.messageBatchSize) {
                    syncPosition.thisRef = groupList[(groupIndex + 1) % groupCount].sourceId; // Continue from the next group in the next sync
                    break;
                }
            }

            // Finalize sync position and status based on message count
            this.updateSyncPosition(
                syncPosition,
                totalMessages,
                groupCount,
                chatHistory
            );

            // Concatenate only items after syncPosition.thisRef and chatHistory
            const remainingGroups = groupList.slice(groupPosition + 1);

            return {
                results: remainingGroups.concat(chatHistory),
                position: syncPosition,
            };
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }

    private getGroupPositionIndex(
        groupList: SchemaSocialChatGroup[],
        syncPosition: SyncHandlerPosition
    ): number {
        const groupPosition = groupList.findIndex(
            (group) => group.sourceId === syncPosition.thisRef
        );

        // If not found, return 0 to start from the beginning
        return groupPosition === -1 ? 0 : groupPosition;
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
        totalMessages: number,
        groupCount: number,
        chatHistory: SchemaSocialChatMessage[]
    ) {
        if (totalMessages === 0) {
            syncPosition.status = SyncHandlerStatus.ENABLED;
            syncPosition.syncMessage = 'No new messages found.';
        } else if (totalMessages < this.config.messageBatchSize) {
            syncPosition.syncMessage = `Processed ${totalMessages} messages across ${groupCount} groups. Sync complete.`;
            syncPosition.status = SyncHandlerStatus.ENABLED;
        } else {
            syncPosition.syncMessage = `Batch complete (${this.config.messageBatchSize}). More results pending.`;
        }
    }
}
