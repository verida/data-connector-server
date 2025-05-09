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
  Comment,
  CommentFullname,
  RedditCommentType,
  RedditConfig,
} from "./types";
import { RedditApi } from "./api";
import { SchemaComment } from "../../schemas";
import { AccountCache } from "./accountCache";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
const _ = require("lodash");

const MAX_BATCH_SIZE = 1000;

export interface SyncCommentResult extends SyncItemsResult {
  items: SchemaComment[];
}

/**
 * @summary This returns everything as a Listing, no need to categorize it
 */
export default class UserCommentHandler extends BaseSyncHandler {
  protected config: RedditConfig;

  public getName(): string {
    return "userComment";
  }

  public getLabel(): string {
    return "User Comments";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.COMMENT;
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
      let comments: SchemaComment[] = [];
      const accountCache = new AccountCache(api);

      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(
          `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
        );
      }

      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

      let currentRange = rangeTracker.nextRange();

      const latestResp = await api.getCommentsCreatedByUser(
        undefined,
        this.config.batchSize,
        undefined,
        currentRange.endId as CommentFullname
      );

      const latestResult = await this.buildResults(
        latestResp as [],
        currentRange.endId
      );

      comments = latestResult.items;
      let nextPageToken = latestResp[latestResp.length - 1].name;

      // Update range if any chats have been fetched
      if (comments.length) {
        rangeTracker.completedRange(
          {
            endId: comments[0].sourceId,
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

      if (!comments.length) {
        syncPosition.syncMessage = `Stopping. No results found.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage =
          comments.length != this.config.batchSize && !nextPageToken
            ? `Processed ${comments.length} items. Stopping. No more results.`
            : `Batch complete (${this.config.batchSize}). More results pending.`;
      }

      syncPosition.thisRef = rangeTracker.export();

      return {
        results: Object.values(comments),
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
    latestResp: Comment[],
    endId?: string
  ): Promise<SyncCommentResult> {
    const results: SchemaComment[] = [];
    let breakHit: SyncItemsBreak;

    for (const comment of latestResp) {
      if (endId && comment.name === endId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `End comment ID hit (${comment.name})`,
        };
        this.emit("log", logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }

      results.push({
        _id: comment.name,
        author: comment.author,
        body: comment.body,
        edited: !!comment.edited,
        parentForum: comment.subreddit_id,
        parentPost: comment.link_id,
        score: comment.score,
        name: comment.name,
      });
    }

    return {
      items: results,
      breakHit,
    };
  }
}
