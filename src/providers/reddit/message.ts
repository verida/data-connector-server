import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";
import {
  ProviderHandlerOption,
  SyncHandlerPosition,
  SyncHandlerStatus,
  SyncItemsBreak,
  SyncItemsResult,
  SyncProviderLogEvent,
  SyncProviderLogLevel,
  SyncResponse,
} from "../../interfaces";
import { ConnectionOptionType } from "../../interfaces";
import {
  Message,
  MessageFullname,
  RedditMessageType,
  RedditConfig,
  Account,
} from "./types";
import { RedditApi } from "./api";
import { SchemaChatMessageType, SchemaSocialChatMessage } from "../../schemas";
import { AccountCache } from "./accountCache";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
const _ = require("lodash");

const MAX_BATCH_SIZE = 1000;

export interface SyncMessagesResult extends SyncItemsResult {
  items: SchemaSocialChatMessage[];
}

/**
 * @summary This returns everything as a Listing, no need to categorize it
 */
export default class MessageHandler extends BaseSyncHandler {
  protected config: RedditConfig;

  public getName(): string {
    return "chat";
  }

  public getLabel(): string {
    return "Chats";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.CHAT_MESSAGE;
  }

  public getProviderApplicationUrl(): string {
    return "https://www.reddit.com/";
  }

  public getOptions(): ProviderHandlerOption[] {
    return [
      {
        id: "backdate",
        label: "Backdate history",
        type: ConnectionOptionType.ENUM,
        enumOptions: [
          {
            value: "1-month",
            label: "1 month",
          },
          {
            value: "3-months",
            label: "3 months",
          },
          {
            value: "6-months",
            label: "6 months",
          },
          {
            value: "12-months",
            label: "12 months",
          },
        ],
        defaultValue: "3-months",
      },
      {
        id: "messageTypes",
        label: "Message types",
        type: ConnectionOptionType.ENUM_MULTI,
        enumOptions: [
          {
            label: "Inbox",
            value: RedditMessageType.INBOX,
          },
          {
            label: "Unread",
            value: RedditMessageType.UNREAD,
          },
          {
            label: "Sent",
            value: RedditMessageType.SENT,
          },
        ],
        // Exclude super groups by default
        defaultValue: [
          RedditMessageType.INBOX,
          RedditMessageType.UNREAD,
          RedditMessageType.SENT,
        ].join(","),
      },
    ];
  }

  /**
   *
   * @summary
   * @param api
   * @param syncPosition
   * @returns
   */
  public async _sync(
    api: RedditApi,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    try {
      let messages: SchemaSocialChatMessage[] = [];
      let messageHistory: SchemaSocialChatMessage[] = [];
      const accountCache = new AccountCache(api);

      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(
          `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
        );
      }

      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

      let currentRange = rangeTracker.nextRange();

      const me = await api.getMe();

      const latestResp = await api.getMessages(
        this.config.messageType ?? "private",
        this.config.batchSize,
        undefined,
        currentRange.endId as MessageFullname
      );
      const latestResult = await this.buildResults(
        accountCache,
        latestResp as [],
        me,
        this.config.messageType ?? "private",
        currentRange.startId
      );

      messages = latestResult.items;
      let nextPageToken = latestResp[latestResp.length - 1].name;

      // Update range if any chats have been fetched
      if (messages.length) {
        rangeTracker.completedRange(
          {
            endId: messages[0].sourceId,
            startId: nextPageToken,
          },
          latestResult.breakHit === SyncItemsBreak.ID
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

      currentRange = rangeTracker.nextRange();

      if (!messages.length) {
        syncPosition.syncMessage = `Stopping. No results found.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage =
          messages.length != this.config.batchSize && !nextPageToken
            ? `Processed ${messages.length} items. Stopping. No more results.`
            : `Batch complete (${this.config.batchSize}). More results pending.`;
      }

      syncPosition.thisRef = rangeTracker.export();

      return {
        results: Object.values(messages).concat(messageHistory),
        position: syncPosition,
      };
    } catch (err: any) {
      console.log(err.message);
      throw err;
    }
  }

  /**
   *
   * @summary Given a listing of chats creates a SyncChatMessagesResult object
   * @param api
   * @param latestResp
   * @param chatType
   * @param endId Optional id to stop
   * @returns
   */
  async buildResults(
    accountCache: AccountCache,
    latestResp: Message[],
    me: Account,
    messageType: "inbox" | "unread" | "sent" | "private",
    endId?: string
  ): Promise<SyncMessagesResult> {
    const results: SchemaSocialChatMessage[] = [];
    let breakHit: SyncItemsBreak;

    for (const message of latestResp) {
      if (endId && message.name === endId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `End message ID hit (${message.name})`,
        };
        this.emit("log", logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }

      // Get the sender account
      const from = await accountCache.getAccount(message.author);

      results.push({
        // TODO
        _id: `reddit-${me.name}-${message.name}`,
        groupId: `private-${from}`,
        groupName: `private-${from}`,
        type: SchemaChatMessageType.RECEIVE,
        messageText: message.body,
        messageHTML: message.body_html,
        fromId: message.author,
        fromHandle: from?.id,
        fromName: from?.name,
        sentAt: new Date(message.created_utc).toDateString(),
        name: message.subject,
        sourceApplication: "https://reddit.com",
        sourceId: message.name,
        sourceData: message,
        insertedAt: new Date(message.created_utc).toString(),
      });
    }

    return {
      items: results,
      breakHit,
    };
  }
}
