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
import { SlackHelpers } from "./helpers";
import { ItemsRange } from "../../helpers/interfaces";

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
        const types = ["im", "private_channel", "public_channel"];

        // Loop through each type of channel (DM, private, public)
        for (const type of types) {
            const conversations = await client.conversations.list({ types: type });
            for (const channel of conversations.channels || []) {
                const group: SchemaSocialChatGroup = this.buildChatGroup(channel);
                channelList.push(group);
            }
        }

        return channelList;
    }

    private buildChatGroup(channel: any): SchemaSocialChatGroup {
        return {
            _id: this.buildItemId(channel.id),
            name: channel.name || channel.user,
            sourceAccountId: this.provider.getAccountId(),
            sourceApplication: this.getProviderApplicationUrl(),
            sourceId: channel.id,
            schema: CONFIG.verida.schemas.CHAT_GROUP,
            sourceData: channel,
            insertedAt: new Date().toISOString(),
        };
    }

    public async _sync(api: any, syncPosition: SyncHandlerPosition): Promise<SyncResponse> {
        try {
            const apiClient = this.getSlackClient();
            const groupList = await this.buildChatGroupList();  // Fetch chat groups

            const groupDs = await this.provider.getDatastore(CONFIG.verida.schemas.CHAT_GROUP);
            const groupDbItems = <SchemaSocialChatGroup[]>await groupDs.getMany({
                sourceAccountId: this.provider.getAccountId(),
            });
            
            const mergedGroupList = this.mergeGroupLists(groupList, groupDbItems);  // Merge new and existing groups

            let totalMessages = 0;
            let chatHistory: SchemaSocialChatMessage[] = [];

            // Determine the current group position
            const groupPosition = SlackHelpers.getGroupPositionIndex(mergedGroupList, syncPosition.thisRef);
            const groupCount = mergedGroupList.length;

            // Iterate over each group
            for (let i = 0; i < Math.min(groupCount, this.config.groupLimit); i++) {
                const groupIndex = (groupPosition + i) % groupCount;  // Rotate through groups
                const group = mergedGroupList[groupIndex];

                let rangeTracker = new ItemsRangeTracker(group.syncData);  // Track items for each group
                const fetchedMessages = await this.fetchAndTrackMessages(group, rangeTracker, apiClient);

                // Concatenate fetched messages
                chatHistory = chatHistory.concat(fetchedMessages);

                // Update the group sync data
                group.syncData = rangeTracker.export();
            }

            // Update sync position and status
            this.updateSyncPosition(syncPosition, totalMessages, groupCount);

            // Return the sync response
            return {
                results: mergedGroupList.concat(chatHistory),
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
        apiClient: WebClient
    ): Promise<SchemaSocialChatMessage[]> {
        if (!group || !group.sourceId) {
            throw new Error("Invalid group or missing group sourceId");
        }

        let items: SchemaSocialChatMessage[] = [];
        let currentRange = rangeTracker.nextRange();

        // Loop to fetch messages in batches
        while (true) {
            const messages = await this.fetchMessageRange(group, currentRange, apiClient);
            if (!messages.length) break;

            items = items.concat(messages);

            if (items.length >= this.config.messagesPerGroupLimit) {
                rangeTracker.completedRange({
                    startId: messages[0].sourceId,
                    endId: messages[messages.length - 1].sourceId,
                }, false);
                break;
            }

            rangeTracker.completedRange({
                startId: messages[0].sourceId,
                endId: messages[messages.length - 1].sourceId,
            }, false);

            currentRange = rangeTracker.nextRange();
        }

        return items;
    }

    private async fetchMessageRange(
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

        for (const message of response.messages || []) {
            if (!message.user) continue;

            const user = await SlackHelpers.getUserInfo(this.connection.accessToken, message.user);
            const chatMessage = this.buildChatMessage(message, chatGroup, user);
            messages.push(chatMessage);
        }

        return messages;
    }

    private buildChatMessage(
        message: any,
        chatGroup: SchemaSocialChatGroup,
        user: any
    ): SchemaSocialChatMessage {
        return {
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
            type: message.user === this.connection.profile.id
                ? SchemaChatMessageType.SEND
                : SchemaChatMessageType.RECEIVE,
            fromId: message.user ?? "Unknown",
            name: message.text.substring(0, 30),
        };
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

    private mergeGroupLists(
        newGroups: SchemaSocialChatGroup[],
        existingGroups: SchemaSocialChatGroup[]
    ): SchemaSocialChatGroup[] {
        return newGroups.map((group) => {
            const existingGroup = existingGroups.find(g => g.sourceId === group.sourceId);
            return existingGroup ? _.merge({}, existingGroup, group) : group;
        });
    }
}
