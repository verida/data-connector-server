import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";

import {
    SyncResponse,
    SyncHandlerPosition,
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
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { ItemsRange } from "../../helpers/interfaces";


const _ = require("lodash");

export default class SlackChatMessageHandler extends BaseSyncHandler {
    protected config: SlackProviderConfig;

    public getName(): string {
        return "chat-message";
    }

    public getLabel(): string {
        return "Chat Messages";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.CHAT_MESSAGE;
    }

    public getProviderApplicationUrl(): string {
        return "https://slack.com";
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
                defaultValue: [SlackChatGroupType.CHANNEL, SlackChatGroupType.GROUP].join(
                    ","
                ),
            },
        ];
    }

    protected async buildChatGroupList(
        syncPosition: SyncHandlerPosition
    ): Promise<SchemaSocialChatGroup[]> {
        let chatGroupIds: string[] = [];
        if (syncPosition.thisRef) {
            chatGroupIds = syncPosition.thisRef.split(",");
        }
        return Object.values([]);
    }


    protected async processChatGroup(
        chatGroup: SchemaSocialChatGroup,
        totalMessageCount: number
    ): Promise<{ chatGroup: SchemaSocialChatGroup; chatHistory: SchemaSocialChatMessage[] }> {
        const chatHistory: SchemaSocialChatMessage[] = [];
        const rangeTracker = new ItemsRangeTracker(chatGroup.syncData);
        let groupMessageCount = 0;
        let newItems = true;

        return {
            chatGroup,
            chatHistory,
        };
    }

    public async _sync(syncPosition: SyncHandlerPosition): Promise<SyncResponse> {
        return 
    }
}
