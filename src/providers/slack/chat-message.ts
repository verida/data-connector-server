import { WebClient } from "@slack/web-api";
import CONFIG from "../../config";
import {
  SyncItemsBreak,
  SyncItemsResult,
  SyncProviderLogEvent,
  SyncProviderLogLevel,
} from "../../interfaces";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import {
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

const _ = require("lodash");

const MAX_BATCH_SIZE = 200; // Slack's API often has lower rate limits

export interface SyncSlackMessagesResult extends SyncItemsResult {
  response_metadata: any;
  items: SchemaSocialChatMessage[];
}

export default class Slack extends BaseSyncHandler {

  public getLabel(): string {
    return "Slack Messages";
  }

  public getName(): string {
    return "slack-messages";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.CHAT_MESSAGE;
  }

  public getProviderApplicationUrl() {
    return "https://slack.com/";
  }

  public getSlackClient(): WebClient {
    const token = this.connection.accessToken;
    return new WebClient(token);
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
        defaultValue: [SlackChatGroupType.CHANNEL, SlackChatGroupType.GROUP].join(","),
      },
    ];
  }

  public async _sync(
    api: any,
    syncPosition: any // Define a more specific Slack sync schema interface
  ): Promise<SyncResponse> {
    if (this.config.batchSize > MAX_BATCH_SIZE) {
      throw new Error(
        `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
      );
    }

    const slack = this.getSlackClient();
    const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
    let items: SchemaSocialChatMessage[] = [];

    let currentRange = rangeTracker.nextRange();
    let latestMessages = await this.fetchMessages(slack, currentRange.startId);

    items = latestMessages.items;

    let nextCursor = _.has(latestMessages, "response_metadata.next_cursor")
      ? latestMessages.response_metadata.next_cursor
      : undefined;

    if (items.length) {
      rangeTracker.completedRange(
        {
          startId: items[0].sourceId,
          endId: nextCursor,
        },
        latestMessages.breakHit === SyncItemsBreak.ID
      );
    } else {
      rangeTracker.completedRange(
        {
          startId: undefined,
          endId: undefined,
        },
        false
      );
    }

    if (!items.length) {
      syncPosition.syncMessage = `Stopping. No results found.`;
      syncPosition.status = SyncHandlerStatus.ENABLED;
    } else {
      if (items.length != this.config.batchSize && !nextCursor) {
        syncPosition.syncMessage = `Processed ${items.length} items. Stopping. No more results.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage = `Batch complete (${this.config.batchSize}). More results pending.`;
      }
    }

    syncPosition.thisRef = rangeTracker.export();

    return {
      results: items,
      position: syncPosition,
    };
  }

  protected async fetchMessages(
    slack: WebClient,
    cursor?: string
  ): Promise<SyncSlackMessagesResult> {
    const result = await slack.conversations.history({
      channel: this.config.channel || "general",
      limit: this.config.batchSize,
      cursor,
    });

    return this.buildResults(result);
  }

  protected async buildResults(
    slackResponse: any
  ): Promise<SyncSlackMessagesResult> {
    const messages = slackResponse.messages;
    const results: SchemaSocialChatMessage[] = [];
    let breakHit: SyncItemsBreak;

    for (const rawMessage of messages) {
      const messageId = rawMessage.ts; // Slack uses timestamp as message ID
      const timestamp = new Date(parseFloat(rawMessage.ts) * 1000).toISOString();
      const content = rawMessage.text || "No message text";
      const fromId = rawMessage.user; // Assuming the user field gives sender ID

      // Fetch sender name from Slack (optional, you might store elsewhere)
      const fromName = await this.fetchUserName(fromId); 
      
      // Assuming groupId and groupName are available from a conversation context
      const groupId = this.config.channel;
      const groupName = await this.fetchChannelName(groupId);

      const message: SchemaSocialChatMessage = {
        _id: this.buildItemId(rawMessage.ts),
        name: content.substring(0, 30), // Truncate for name
        groupId,
        groupName,
        type: rawMessage.user === this.config.currentUserId
          ? SchemaChatMessageType.SEND
          : SchemaChatMessageType.RECEIVE,
        fromId,
        fromHandle: fromName,
        fromName: fromName,
        messageText: content,
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: rawMessage.ts,
        sourceData: rawMessage,
        insertedAt: timestamp,
        sentAt: timestamp,
      };

      results.push(message);
    }

    return {
      items: results,
      response_metadata: messages.response_metadata,
      breakHit,
    };
  }

  // Optional helper method to fetch user names from Slack
  protected async fetchUserName(userId: string): Promise<string> {
    const slack = this.getSlackClient();
    const userInfo = await slack.users.info({ user: userId });
    return userInfo.user ? userInfo.user.real_name : "Unknown User";
  }

  // Optional helper method to fetch channel name from Slack
  protected async fetchChannelName(channelId: string): Promise<string> {
    const slack = this.getSlackClient();
    const channelInfo = await slack.conversations.info({ channel: channelId });
    return channelInfo.channel ? channelInfo.channel.name : "Unknown Channel";
  }
}
