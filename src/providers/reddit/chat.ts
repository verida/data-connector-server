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
import { RedditChatType, RedditConfig } from "./reddit";
import { RedditApi } from "./api";
import {
  SchemaChatMessageType,
  SchemaSocialChatGroup,
  SchemaSocialChatMessage,
} from "../../schemas";
import { UsersCache } from "../telegram/usersCache";
import InvalidTokenError from "../InvalidTokenError";
import { TDError } from "tdlib-native/dist";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { Listing, PrivateMessage, User } from "@devvit/public-api";
const _ = require("lodash");

const MAX_BATCH_SIZE = 1000;

export interface SyncChatMessagesResult extends SyncItemsResult {
  items: SchemaSocialChatMessage[];
}

/**
 * @summary This returns everything as a Listing, no need to categorize it
 */
export default class MessagesHandler extends BaseSyncHandler {
  protected config: RedditConfig;

  public getName(): string {
    return "messages";
  }

  public getLabel(): string {
    return "Messages";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.CHAT_MESSAGE;
  }

  public getProviderApplicationUrl(): string {
    return "https://chat.reddit.com/";
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
            value: RedditChatType.INBOX,
          },
          {
            label: "Unread",
            value: RedditChatType.UNREAD,
          },
          {
            label: "Sent",
            value: RedditChatType.SENT,
          },
        ],
        // Exclude super groups by default
        defaultValue: [
          RedditChatType.INBOX,
          RedditChatType.UNREAD,
          RedditChatType.SENT,
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
    // const chatGroupDs = await this.provider.getDatastore(CONFIG.verida.schemas.CHAT_GROUP)
    // const db2 = await chatGroupDs.getDb()
    // await db2.destroy({})

    // const chatMessageDs = await this.provider.getDatastore(CONFIG.verida.schemas.CHAT_MESSAGE)
    // const db = await chatMessageDs.getDb()
    // await db.destroy({})
    // throw new Error('destroyed')

    try {
      let messageCount = 0;
      let chats: SchemaSocialChatMessage[] = [];
      let chatHistory: SchemaSocialChatMessage[] = [];

      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(
          `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
        );
      }

      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

      let currentRange = rangeTracker.nextRange();

      const latestResp = await api.getChats("inbox", this.config.batchSize);
      const latestResult = await this.buildResults(
        api,
        latestResp,
        "inbox",
        currentRange.endId,
        _.has(this.config, "breakTimestamp")
          ? this.config.breakTimestamp
          : undefined
      );

      chats = latestResult.items;
      let nextPageToken = _.get(latestResp, "data.nextPageToken");

      // Update range if any chats have been fetched
      if (chats.length) {
        rangeTracker.completedRange(
          {
            startId: chats[0].sourceId,
            endId: nextPageToken,
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

      // TODO
      // if (chats.length != this.config.batchSize && currentRange.startId) {

      if (!chats.length) {
        syncPosition.syncMessage = `Stopping. No results found.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage =
          chats.length != this.config.batchSize && !nextPageToken
            ? `Processed ${chats.length} items. Stopping. No more results.`
            : `Batch complete (${this.config.batchSize}). More results pending.`;
      }

      syncPosition.thisRef = rangeTracker.export();

      return {
        results: Object.values(chats).concat(chatHistory),
        position: syncPosition,
      };
    } catch (err: any) {
      console.log(err.message);
      if (err instanceof TDError) {
        if (err.code == 401) {
          throw new InvalidTokenError(err.message);
        }
      }
      throw err;
    }
  }

  async buildResults(
    api: RedditApi,
    latestResp: Listing<PrivateMessage>,
    messageType: "inbox" | "unread" | "sent",
    endId: string,
    arg3: string
  ): Promise<SyncChatMessagesResult> {
    const results: SchemaSocialChatMessage[] = [];
    let breakHit: SyncItemsBreak;

    for (const chat of await latestResp.all()) {
      if (chat.id === endId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `End ID hit (${chat.id})`,
        };
        this.emit("log", logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }

      const createdTime = chat.created ?? new Date().toISOString();

      // Get the "from" user
      const from = await this.getUser(api, chat.from.id);

      results.push({
        _id: chat.id,
        // TODO
        groupId: "",
        // TODO This is documented but not included in the Devvit types
        // @ts-ignore
        groupName: chat.name,
        type:
          messageType === "inbox" || messageType === "unread"
            ? SchemaChatMessageType.RECEIVE
            : SchemaChatMessageType.SEND,
        messageText: chat.body,
        messageHTML: chat.bodyHtml,
        fromId: chat.from.id,
        // TODO Get these from api, keep a cache and first fetch it from there
        fromHandle: from.username,
        // TODO Get displayName
        fromName: from.username,
        sentAt: chat.created.toDateString(),
        name: `Private message: ${chat.from}`,
      });
    }

    return {
      items: results,
      breakHit,
    };
  }

  // TODO Refactor
  cache: Map<string, User> = new Map();

  /**
   * 
   * @summary Fetch a user or retrieve it from the cache
   * @param api 
   * @param id 
   * @returns 
   */
  async getUser(api: RedditApi, id: string) {
    const userFromCache = this.cache.get(id);

    if (!userFromCache) {
      const user = await api.getUser(id);
      this.cache.set(id, user);
    }

    return userFromCache;
  }
}
