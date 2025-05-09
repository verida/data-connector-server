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
  RedditConfig,
  Subreddit,
  SubredditFullname,
  SubredditType,
} from "./types";
import { RedditApi } from "./api";
import { SchemaForum } from "../../schemas";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
const _ = require("lodash");

const MAX_BATCH_SIZE = 1000;

export interface SyncSubredditResult extends SyncItemsResult {
  items: SchemaForum[];
  // Returns the id of a subcribbed subreddits id in the items array
  favourited: number[];
}

/**
 * @summary This returns everything as a Listing, no need to categorize it
 */
export default class SubredditHandler extends BaseSyncHandler {
  protected config: RedditConfig;

  public getName(): string {
    return "subreddit";
  }

  public getLabel(): string {
    return "Subreddits";
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
        id: "subredditTypes",
        label: "Subreddit relation types",
        type: ConnectionOptionType.ENUM_MULTI,
        enumOptions: [
          {
            label: "Contributor",
            value: SubredditType.CONTRIBUTOR,
          },
          {
            label: "Moderator",
            value: SubredditType.MODERATOR,
          },
          {
            label: "Subscriber",
            value: SubredditType.SUBSCRIBER,
          },
        ],
        // Exclude super groups by default
        defaultValue: [
          SubredditType.CONTRIBUTOR,
          SubredditType.MODERATOR,
          SubredditType.SUBSCRIBER,
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
      let subreddits: SchemaForum[] = [];
      let subredditHistory: SchemaForum[] = [];

      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(
          `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
        );
      }

      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

      let currentRange = rangeTracker.nextRange();

      const latestResp = await api.getSubreddits(
        this.config.subredditType,
        this.config.batchSize,
        undefined,
        currentRange.endId as SubredditFullname
      );
      const latestResult = await this.buildResults(
        latestResp,
        currentRange.endId
      );

      subreddits = latestResult.items;
      let nextPageToken = latestResp[latestResp.length - 1].name;

      // Update range if any chats have been fetched
      if (subreddits.length) {
        rangeTracker.completedRange(
          {
            startId: subreddits[0].sourceId,
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

      if (!subreddits.length) {
        syncPosition.syncMessage = `Stopping. No results found.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage =
          subreddits.length != this.config.batchSize && !nextPageToken
            ? `Processed ${subreddits.length} items. Stopping. No more results.`
            : `Batch complete (${this.config.batchSize}). More results pending.`;
      }

      syncPosition.thisRef = rangeTracker.export();

      return {
        results: Object.values(subreddits).concat(subredditHistory),
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
    latestResp: Subreddit[],
    endId?: string
  ): Promise<SyncSubredditResult> {
    const results: SchemaForum[] = [];
    let breakHit: SyncItemsBreak;
    const favourited = [];

    for (const subreddit of await latestResp) {
      if (endId && subreddit.name === endId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `End subreddit ID hit (${subreddit.name})`,
        };
        this.emit("log", logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }
      // Get the "from" user
      const index = results.push({
        _id: subreddit.name,
        description: subreddit.description,
        over18: subreddit.over18,
        type:
          subreddit.subreddit_type !== "gold_restricted"
            ? subreddit.subreddit_type
            : "restricted",
        summary: subreddit.header_title,
        icon: subreddit.header_img,
        uri: subreddit.url,
        name: subreddit.title,
        sourceApplication: "https://reddit.com",
        sourceId: subreddit.name,
        sourceData: subreddit,
        insertedAt: new Date(subreddit.created_utc).toString(),
      });
      if (subreddit.user_is_subscribe) favourited.push(index);
    }

    return {
      items: results,
      // TODO
      favourited,
      breakHit,
    };
  }
}
