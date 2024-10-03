import { WebClient } from "@slack/web-api";
import CONFIG from "../../config";
import {
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
import { SlackChatGroupType, SlackHandlerConfig } from "./interfaces";
import BaseSyncHandler from "../BaseSyncHandler";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { ItemsRange } from "../../helpers/interfaces";
import { SlackHelpers } from "./helpers";

const _ = require("lodash");

export default class SlackChatMessageHandler extends BaseSyncHandler {
    protected config: SlackHandlerConfig;

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

        let channelList: SchemaSocialChatGroup[] = [];

        // Fetch all types of conversations: DMs, private, public
        const types = ["im", "private_channel", "public_channel"];
        for (const type of types) {
            const conversations = await client.conversations.list({
                types: type,
            });

            for (const channel of conversations.channels) {
                const group: SchemaSocialChatGroup = {
                    _id: this.buildItemId(channel.id),
                    name: channel.name || channel.user,
                    sourceAccountId: this.provider.getAccountId(),
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
            if (!message.user) continue;
            
            const user = await SlackHelpers.getUserInfo(this.connection.accessToken, message.user)
            const chatMessage: SchemaSocialChatMessage = {
                _id: this.buildItemId(message.ts),
                groupId: chatGroup._id,
                groupName: chatGroup.name,
                messageText: message.text,
                fromHandle: user.profile.email ?? "Unknown",
                sourceAccountId: this.provider.getAccountId(),
                sourceApplication: this.getProviderApplicationUrl(),
                sourceId: message.ts,
                sourceData: message,
                insertedAt: new Date(parseFloat(message.ts) * 1000).toISOString(),
                sentAt: new Date(parseFloat(message.ts) * 1000).toISOString(),
                type:
                    message.user === this.connection.profile.id
                        ? SchemaChatMessageType.SEND
                        : SchemaChatMessageType.RECEIVE,
                fromId: message.user ?? "Unknown",
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
            for (let i = 0; i < Math.min(groupCount, this.config.groupLimit); i++) {
                const groupIndex = (groupPosition + i) % groupCount; // Rotate through groups
                const group = groupList[groupIndex];

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
                    syncPosition.thisRef = groupList[(groupIndex + 1) % groupCount].sourceId; // Continue from the next group in the next sync
                    break;
                }
            }

            // Finalize sync position and status based on message count
            this.updateSyncPosition(
                syncPosition,
                totalMessages,
                groupCount
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
        apiClient: WebClient
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
            if (items.length > this.config.messagesPerGroupLimit) {
                // Mark the current range as complete and stop
                rangeTracker.completedRange({
                    startId: messages[0].sourceId,
                    endId: messages[messages.length - 1].sourceId
                }, false);
                break;
            } else {
                // Update rangeTracker and continue fetching
                rangeTracker.completedRange({
                    startId: messages[0].sourceId,
                    endId: messages[messages.length - 1].sourceId
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
        groupCount: number
    ) {
        if (totalMessages === 0) {
            syncPosition.status = SyncHandlerStatus.ENABLED;
            syncPosition.syncMessage = "No new messages found.";
        } else if (totalMessages < this.config.messageBatchSize) {
            syncPosition.syncMessage = `Processed ${totalMessages} messages across ${groupCount} groups. Sync complete.`;
            syncPosition.status = SyncHandlerStatus.ENABLED;
        } else {
            syncPosition.status = SyncHandlerStatus.SYNCING;
            syncPosition.syncMessage = `Batch complete (${this.config.messageBatchSize}). More results pending.`;
        }
    }
}
