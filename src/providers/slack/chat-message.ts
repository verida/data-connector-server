import { WebClient } from "@slack/web-api";
import CONFIG from "../../config";
import {
    SyncItemsResult,
    SyncResponse,
    SyncHandlerStatus,
    ProviderHandlerOption,
    ConnectionOptionType,
    SyncHandlerPosition,
} from "../../interfaces";
import {
    SchemaChatMessageType,
    SchemaSocialChatGroup,
    SchemaSocialChatMessage,
} from "../../schemas";
import { SlackChatGroupType, SlackProviderConfig } from "./interfaces";
import BaseSyncHandler from "../BaseSyncHandler";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { ItemsRange } from "../../helpers/interfaces";

const _ = require("lodash");

export default class SlackChatMessageHandler extends BaseSyncHandler {
    protected config: SlackProviderConfig;

    public getName(): string {
        return "slack-messages";
    }

    public getLabel(): string {
        return "Slack Messages";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.CHAT_MESSAGE;
    }

    public getProviderApplicationUrl(): string {
        return "https://slack.com/";
    }

    public getOptions(): ProviderHandlerOption[] {
        return [
            {
                id: "channelTypes",
                label: "Channel types",
                type: ConnectionOptionType.ENUM_MULTI,
                enumOptions: [
                    { label: "Public Channel", value: SlackChatGroupType.CHANNEL },
                    { label: "Private Channel", value: SlackChatGroupType.GROUP },
                    { label: "Direct Messages", value: SlackChatGroupType.IM },
                ],
                defaultValue: [
                    SlackChatGroupType.CHANNEL,
                    SlackChatGroupType.GROUP,
                    SlackChatGroupType.IM,
                ].join(","),
            },
        ];
    }

    public getSlackClient(): WebClient {
        const token = this.connection.accessToken;
        return new WebClient(token);
    }

    protected async buildChatGroupList(): Promise<SchemaSocialChatGroup[]> {
        const client = this.getSlackClient();
        let chatGroupIds: string[] = [];
        let channelList: SchemaSocialChatGroup[] = [];

        // Fetch all types of conversations: DMs, private, public
        const types = ["im", "private_channel", "public_channel"];
        for (const type of types) {
            const conversations = await client.conversations.list({
                types: type,
                limit: this.config.groupLimit,
            });

            for (const channel of conversations.channels) {
                const group: SchemaSocialChatGroup = {
                    _id: this.buildItemId(channel.id),
                    name: channel.name || channel.user,
                    sourceApplication: this.getProviderApplicationUrl(),
                    sourceId: channel.id,
                    schema: CONFIG.verida.schemas.CHAT_GROUP,
                    sourceData: channel,
                    insertedAt: new Date().toISOString(),
                };
                channelList.push(group);
            }
        }
        return channelList;
    }

    protected async fetchMessageRange(
        chatGroup: SchemaSocialChatGroup,
        range: ItemsRange,
        apiClient: WebClient
    ): Promise<SchemaSocialChatMessage[]> {
        const messages: SchemaSocialChatMessage[] = [];

        const response = await apiClient.conversations.history({
            channel: chatGroup.sourceId!,
            limit: this.config.messagesPerGroupLimit,
            oldest: range.startId,
            latest: range.endId,
        });

        for (const message of response.messages) {
            const chatMessage: SchemaSocialChatMessage = {
                _id: this.buildItemId(message.ts),
                groupId: chatGroup._id,
                groupName: chatGroup.name,
                messageText: message.text,
                fromHandle: message.user,
                sourceApplication: this.getProviderApplicationUrl(),
                sourceId: message.ts,
                sourceData: message,
                insertedAt: new Date(parseFloat(message.ts) * 1000).toISOString(),
                sentAt: new Date(parseFloat(message.ts) * 1000).toISOString(),
                type:
                    message.user === this.connection.profile.id
                        ? SchemaChatMessageType.SEND
                        : SchemaChatMessageType.RECEIVE,
                fromId: message.user,
                name: message.text.substring(0, 30),
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
            const apiClient = this.getSlackClient();
            const groupList = await this.buildChatGroupList(); // Fetch all public, private, and DM groups

            let totalMessages = 0;
            let chatHistory: SchemaSocialChatMessage[] = [];

            // Determine the current group position
            let groupPosition = this.getGroupPositionIndex(groupList, syncPosition);

            const groupCount = groupList.length;

            // Iterate over each group 
            for (let i = 0; i < groupCount; i++) {
                const groupIndex = (groupPosition + i) % groupCount; // Rotate through groups
                const group = groupList[groupIndex];

                // Stop processing if batch size is reached
                if (totalMessages >= this.config.messageBatchSize) {
                    syncPosition.thisRef = groupList[groupIndex + 1].sourceId; // Save the next group to process
                    break;
                }

                // Use a separate ItemsRangeTracker for each group
                let rangeTracker = new ItemsRangeTracker(group.syncData);

                const fetchedMessages = await this.fetchAndTrackMessages(
                    group,
                    rangeTracker,
                    apiClient
                );

                // Concatenate the fetched messages to the total chat history
                chatHistory = chatHistory.concat(fetchedMessages);
                totalMessages += fetchedMessages.length;

                // Update the group's sync data with the latest rangeTracker state
                group.syncData = rangeTracker.export();

                // Stop if the total messages fetched reach the batch size
                if (totalMessages >= this.config.messageBatchSize) {
                    syncPosition.thisRef = groupList[groupIndex + 1].sourceId; // Continue from the next group in the next sync
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
        group: any,
        rangeTracker: ItemsRangeTracker,
        apiClient: any
    ): Promise<SchemaSocialChatMessage[]> {
        // Initialize range from tracker
        let currentRange = rangeTracker.nextRange();
        let items: SchemaSocialChatMessage[] = [];

        while (true) {
            // Construct query based on range
            let query: any = {
                channel: group.id,
                limit: this.config.batchSize,  // Default = 100, adjust if necessary
            };

            if (currentRange.startId) {
                query.cursor = currentRange.startId; // Slack uses cursor for pagination
            }

            // Fetch messages from Slack API
            const response = await apiClient.conversations.history(query);
            const messages = response.messages || [];

            // Process messages
            items = items.concat(messages);

            // Break loop if no more messages or limit reached
            if (messages.length < this.config.batchSize || !response.has_more) {
                // Update rangeTracker
                rangeTracker.completedRange({
                    startId: messages.length ? messages[0].ts : undefined,
                    endId: response.response_metadata?.next_cursor || undefined
                }, false);

                break;
            } else {
                // Update range and continue fetching
                rangeTracker.completedRange({
                    startId: messages[0].ts,
                    endId: response.response_metadata?.next_cursor
                }, false);

                currentRange = rangeTracker.nextRange();
            }
        }

        return items;
    }

    private updateRangeTracker(
        rangeTracker: ItemsRangeTracker,
        messages: SchemaSocialChatMessage[],
        currentRange: { startId?: string; endId?: string }
    ) {
        if (messages.length) {
            const firstMessage = messages[0];
            const lastMessage = messages[messages.length - 1];

            // Mark the range as completed with fetched messages
            rangeTracker.completedRange(
                { startId: firstMessage._id, endId: lastMessage._id },
                false // Update if there's a break condition
            );
        } else {
            // No messages found, so mark the range as completed without changes
            rangeTracker.completedRange(
                { startId: undefined, endId: undefined },
                false
            );
        }
    }

    private updateSyncPosition(
        syncPosition: SyncHandlerPosition,
        totalMessages: number,
        groupCount: number,
        chatHistory: SchemaSocialChatMessage[]
    ) {
        if (totalMessages === 0) {
            syncPosition.status = SyncHandlerStatus.COMPLETED;
            syncPosition.syncMessage = "No new messages found.";
        } else if (totalMessages < this.config.messageBatchSize) {
            syncPosition.syncMessage = `Processed ${totalMessages} messages across ${groupCount} groups. Sync complete.`;
            syncPosition.status = SyncHandlerStatus.ENABLED;
        } else {
            syncPosition.syncMessage = `Batch complete (${this.config.messageBatchSize}). More results pending.`;
        }
    }
}
