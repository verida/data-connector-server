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
  Account,
  Post,
  PostFullname,
  RedditConfig,
  RedditPostType,
} from "./types";
import { RedditApi } from "./api";
import { SchemaPost, SchemaPostType } from "../../schemas";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
const _ = require("lodash");

const log4js = require("log4js");
const logger = log4js.getLogger();

const MAX_BATCH_SIZE = 1000;

export interface SyncPostResult extends SyncItemsResult {
  items: SchemaPost[];
}

/**
 * @summary This returns everything as a Listing, no need to categorize it
 */
export default class UserPostHandler extends BaseSyncHandler {
  protected config: RedditConfig;

  public getName(): string {
    return "userPost";
  }

  public getLabel(): string {
    return "User Posts";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.POST;
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
      let posts: SchemaPost[] = [];

      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(
          `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
        );
      }

      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

      let currentRange = rangeTracker.nextRange();

      const me = await api.getMe();

      const latestResp = await api.getPostsCreatedByUser(
        undefined,
        this.config.batchSize,
        undefined,
        currentRange.endId as PostFullname
      );

      const latestResult = await this.buildResults(
        latestResp,
        me,
        RedditPostType.DOWNVOTED,
        currentRange.endId
      );

      posts = latestResult.items;
      let nextPageToken = latestResp[latestResp.length - 1].name;

      // Update range if any chats have been fetched
      if (posts.length) {
        rangeTracker.completedRange(
          {
            startId: posts[0].sourceId,
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

      if (!posts.length) {
        syncPosition.syncMessage = `Stopping. No results found.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage =
          posts.length != this.config.batchSize && !nextPageToken
            ? `Processed ${posts.length} items. Stopping. No more results.`
            : `Batch complete (${this.config.batchSize}). More results pending.`;
      }

      syncPosition.thisRef = rangeTracker.export();

      return {
        results: Object.values(posts),
        position: syncPosition,
      };
    } catch (err: any) {
      logger.error(err.message);
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
    latestResp: Post[],
    me: Account,
    postType?: RedditPostType,
    endId?: string
  ): Promise<SyncPostResult> {
    const results: SchemaPost[] = [];
    let breakHit: SyncItemsBreak;

    for (const post of await latestResp) {
      if (endId && post.name === endId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `End post ID hit (${post.name})`,
        };
        this.emit("log", logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }

      results.push({
        _id: `reddit-${me.name}-${post.name}`,
        type: SchemaPostType.NOTE,
        name: post.title,
        sourceApplication: "https://reddit.com",
        sourceId: post.name,
        sourceData: post,
        insertedAt: new Date(post.created_utc).toDateString(),
      });
    }

    return {
      items: results,
      breakHit,
    };
  }
}
