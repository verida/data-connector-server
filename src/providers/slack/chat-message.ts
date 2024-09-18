import { WebClient } from "@slack/web-api";
import CONFIG from "../../config";
import {
    SyncItemsResult,
    SyncResponse,
    SyncHandlerStatus,
    ProviderHandlerOption,
    ConnectionOptionType,
} from "../../interfaces";
import {
    SchemaChatMessageType,
    SchemaSocialChatGroup,
    SchemaSocialChatMessage,
} from "../../schemas";
import { SlackChatGroupType, SlackProviderConfig } from "./interfaces";
import BaseSyncHandler from "../BaseSyncHandler";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";

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
                    { label: "Channel", value: SlackChatGroupType.CHANNEL },
                    { label: "Group", value: SlackChatGroupType.GROUP },
                ],
                defaultValue: [
                    SlackChatGroupType.CHANNEL,
                    SlackChatGroupType.GROUP,
                ].join(","),
            },
        ];
    }

    public getSlackClient(): WebClient {
        const token = this.connection.accessToken;
        return new WebClient(token);
    }

    protected async buildChatGroupList(syncPosition: any): Promise<SchemaSocialChatGroup[]> {
        const client = this.getSlackClient();
        let channelList: SchemaSocialChatGroup[] = [];

        // Fetch all conversations (channels and groups)
        const conversations = await client.conversations.list({ limit: this.config.groupLimit });

        for (const channel of conversations.channels) {
            const group: SchemaSocialChatGroup = {
                _id: this.buildItemId(channel.id),
                name: channel.name,
                sourceApplication: this.getProviderApplicationUrl(),
                sourceId: channel.id,
                schema: CONFIG.verida.schemas.CHAT_GROUP,
                sourceData: channel,
                insertedAt: new Date().toISOString(),
            };
            channelList.push(group);
        }
        return channelList;
    }

    protected async fetchMessageRange(
        chatGroup: SchemaSocialChatGroup,
        rangeTracker: ItemsRangeTracker,
        apiClient: WebClient
    ): Promise<SchemaSocialChatMessage[]> {
        const range = rangeTracker.nextRange();
        const messages: SchemaSocialChatMessage[] = [];

        const response = await apiClient.conversations.history({
            channel: chatGroup.sourceId!,
            limit: this.config.messagesPerGroupLimit,
            oldest: range.startId,
            latest: range.endId,
        });

        for (const message of response.messages) {
            console.log("============");
            console.log(message);
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
                type: message.user === this.connection.profile.id
                    ? SchemaChatMessageType.SEND
                    : SchemaChatMessageType.RECEIVE,
                fromId: message.user,
                name: message.text.substring(0, 30)
            };
            messages.push(chatMessage);
        }

        return messages;
    }

    public async _sync(
        api: any,
        syncPosition: any
    ): Promise<SyncResponse> {
        try {
            const apiClient = this.getSlackClient();
            const groupList = await this.buildChatGroupList(syncPosition);
            let totalMessages = 0;
            let chatHistory: SchemaSocialChatMessage[] = [];

            for (const group of groupList) {
                if (totalMessages >= this.config.messageBatchSize) break;

                const rangeTracker = new ItemsRangeTracker(group.syncData);
                const messages = await this.fetchMessageRange(group, rangeTracker, apiClient);

                chatHistory = chatHistory.concat(messages);
                totalMessages += messages.length;

                if (totalMessages >= this.config.messageBatchSize) break;
            }

            if (totalMessages === 0) {
                syncPosition.status = SyncHandlerStatus.COMPLETED;
            }

            return {
                results: chatHistory,
                position: syncPosition,
            };
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }
}
