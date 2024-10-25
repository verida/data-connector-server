import {
  ConversationsHistoryArguments,
  ConversationsHistoryResponse,
  WebClient,
} from "@slack/web-api";
import CONFIG from "../../config";
import {
  SyncResponse,
  SyncHandlerStatus,
  ProviderHandlerOption,
  ConnectionOptionType,
  SyncHandlerPosition,
  SyncItemsResult,
  SyncItemsBreak,
  SyncProviderLogLevel,
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

import { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse";

const _ = require("lodash");

export interface SyncChatItemsResult extends SyncItemsResult {
  items: SchemaSocialChatMessage[];
}

export default class SlackChatMessageHandler extends BaseSyncHandler {
  protected config: SlackHandlerConfig;

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

    for (const type of types) {
      const conversations = await client.conversations.list({ types: type });
      for (const channel of conversations.channels || []) {
        if (channel?.is_archived) continue;
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

  public async _sync(
    api: any,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    try {
      const apiClient = this.getSlackClient();
      const groupList = await this.buildChatGroupList();
      const groupDs = await this.provider.getDatastore(
        CONFIG.verida.schemas.CHAT_GROUP
      );
      const groupDbItems = <SchemaSocialChatGroup[]>await groupDs.getMany({
        sourceAccountId: this.provider.getAccountId(),
      });

      const mergedGroupList = this.mergeGroupLists(groupList, groupDbItems);
      let totalMessages = 0;
      let chatHistory: SchemaSocialChatMessage[] = [];

      for (let i = 0; i < mergedGroupList.length; i++) {
        const group = mergedGroupList[i];
        let rangeTracker = new ItemsRangeTracker(group.syncData);

        const fetchedMessages = await this.fetchAndTrackMessages(
          group,
          rangeTracker,
          apiClient
        );

        chatHistory = chatHistory.concat(fetchedMessages);
        totalMessages += fetchedMessages.length;

        mergedGroupList[i].syncData = rangeTracker.export();
      }

      this.updateSyncPosition(syncPosition, totalMessages, mergedGroupList.length);

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

    let query: ConversationsHistoryArguments = {
      channel: group.sourceId!,
      limit: this.config.messagesPerGroupLimit,
    };

    if (currentRange.startId) {
      query.cursor = currentRange.startId;
    }

    const response = await apiClient.conversations.history(query);
    const latestResult = await this.buildResults(
      group.sourceId!,
      response,
      currentRange.endId
    );

    items = latestResult.items;

    if (items.length) {
      rangeTracker.completedRange(
        {
          startId: items[0].sourceId,
          endId: response.response_metadata?.next_cursor,
        },
        latestResult.breakHit == SyncItemsBreak.ID
      );
    } else {
      rangeTracker.completedRange(
        { startId: undefined, endId: undefined },
        false
      );
    }

    currentRange = rangeTracker.nextRange();

    if (items.length != this.config.messagesPerGroupLimit && currentRange.startId) {
      const query: ConversationsHistoryArguments = {
        channel: group.sourceId!,
        limit: this.config.messagesPerGroupLimit - items.length,
        cursor: currentRange.startId,
      };

      const backfillResponse = await apiClient.conversations.history(query);
      const backfillResult = await this.buildResults(
        group.sourceId!,
        backfillResponse,
        currentRange.endId
      );

      items = items.concat(backfillResult.items);
      if (backfillResult.items.length) {
        rangeTracker.completedRange({
          startId: backfillResult.items[0].sourceId,
          endId: backfillResponse.response_metadata?.next_cursor,
        }, backfillResult.breakHit == SyncItemsBreak.ID);
      } else {
        rangeTracker.completedRange({
          startId: undefined,
          endId: undefined,
        }, backfillResult.breakHit == SyncItemsBreak.ID);
      }
    }
    return items;
  }

  private async buildResults(
    groupId: string,
    response: ConversationsHistoryResponse,
    breakId: string
  ): Promise<SyncChatItemsResult> {
    const results: SchemaSocialChatMessage[] = [];
    const userIds = new Set<string>();
    let breakHit: SyncItemsBreak;

    // Collect unique user IDs from messages
    for (const message of response.messages || []) {
      if (message.subtype === 'bot_message') continue;
      userIds.add(message.user);
    }

    // Fetch user info for all unique user IDs in parallel
    const userInfoMap = await SlackHelpers.fetchUserInfoBulk(this.connection.accessToken, Array.from(userIds));

    for (const message of response.messages || []) {
      if (message.subtype === 'bot_message') continue;

      const messageId = message.ts || "";
      if (messageId === breakId) {
        this.emit("log", {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId}) in group (${groupId})`,
        });
        breakHit = SyncItemsBreak.ID;
        break;
      }

      const user = userInfoMap[message.user];
      const messageRecord = await this.buildResult(groupId, message, user);
      results.push(messageRecord);
    }

    return {
      items: results,
      breakHit,
    };
  }

  private async buildResult(
    groupId: string,
    message: MessageElement,
    user: any
  ): Promise<SchemaSocialChatMessage> {
    return {
      _id: this.buildItemId(message.ts),
      groupId: groupId,
      messageText: message.text,
      fromHandle: user.profile.email,
      sourceAccountId: this.provider.getAccountId(),
      sourceApplication: this.getProviderApplicationUrl(),
      sourceId: message.ts,
      schema: CONFIG.verida.schemas.CHAT_MESSAGE,
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
  }

  private updateSyncPosition(
    syncPosition: SyncHandlerPosition,
    totalMessages: number,
    groupCount: number
  ) {
    syncPosition.status = SyncHandlerStatus.SYNCING;
    syncPosition.syncMessage = `Batch complete (${totalMessages}) across (${groupCount} groups)`;
  }

  private mergeGroupLists(
    newGroups: SchemaSocialChatGroup[],
    existingGroups: SchemaSocialChatGroup[]
  ): SchemaSocialChatGroup[] {
    return newGroups.map((group) => {
      const existingGroup = existingGroups.find(
        (g) => g.sourceId === group.sourceId
      );
      return existingGroup ? _.merge({}, existingGroup, group) : group;
    });
  }
}
