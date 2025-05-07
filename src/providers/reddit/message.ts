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
import { RedditChatType, RedditConfig } from "./types";
import { RedditApi } from "./api";
import { SchemaChatMessageType, SchemaSocialChatMessage } from "../../schemas";
import { UsersCache } from "./usersCache";
import InvalidTokenError from "../InvalidTokenError";
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
        id: "chatTypes",
        label: "Chat types",
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
    try {
      let chats: SchemaSocialChatMessage[] = [];
      let chatHistory: SchemaSocialChatMessage[] = [];
      const userCache = new UsersCache(api);

      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(
          `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
        );
      }

      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

      let currentRange = rangeTracker.nextRange();

      const latestResp = await api.getMessages(
        "inbox"
        // , this.config.batchSize
      );
      const latestResult = await this.buildResults(
        api,
        userCache,
        latestResp as [],
        "inbox",
        currentRange.endId
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
    api: RedditApi,
    userCache: UsersCache,
    // latestResp: Listing<PrivateMessage>,
    latestResp: [],
    chatType: "inbox" | "unread" | "sent",
    endId?: string
  ): Promise<SyncChatMessagesResult> {
    const results: SchemaSocialChatMessage[] = [];
    let breakHit: SyncItemsBreak;

    for (const chat of await latestResp) {
      // if (endId && chat.id === endId) {
      //   const logEvent: SyncProviderLogEvent = {
      //     level: SyncProviderLogLevel.DEBUG,
      //     message: `End chat ID hit (${chat.id})`,
      //   };
      //   this.emit("log", logEvent);
      //   breakHit = SyncItemsBreak.ID;
      //   break;
      // }
      //   const createdTime = chat.created ?? new Date().toISOString();
      //   // Get the "from" user
      //   const from = await userCache.getUser(chat.from.id);
      //   results.push({
      //     _id: chat.id,
      //     // NOTE This is
      //     groupId: "",
      //     // TODO This is documented but not included in the Devvit types
      //     // @ts-ignore
      //     groupName: chat.name,
      //     type:
      //       chatType === "inbox" || chatType === "unread"
      //         ? SchemaChatMessageType.RECEIVE
      //         : SchemaChatMessageType.SEND,
      //     messageText: chat.body,
      //     messageHTML: chat.bodyHtml,
      //     fromId: chat.from.id,
      //     // NOTE Handle and username is the same
      //     fromHandle: from.username,
      //     fromName: from.username,
      //     sentAt: chat.created.toDateString(),
      //     name: `Private chat: ${chat.from}`,
      //   });
    }

    return {
      items: results,
      breakHit,
    };
  }
}
