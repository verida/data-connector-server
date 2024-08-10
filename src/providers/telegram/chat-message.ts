import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";

import {
  SyncResponse,
  SyncHandlerPosition,
  SyncHandlerStatus,
} from "../../interfaces";
import {
  ContentType,
  FavouriteType,
  SchemaFavourite,
  SchemaYoutubeActivityType,
} from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { TelegramApi } from "./api";

const _ = require("lodash");

export default class TelegramChatMessageHandler extends BaseSyncHandler {
  public getName(): string {
    return "chat-message";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.FAVOURITE;
  }

  public getProviderApplicationUrl(): string {
    return "https://telegram.com";
  }

  public async _sync(
    api: TelegramApi,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    try {
        const chatId = 0

      const client = await api.getClient(true)

      const chats = await client.api.getChats({
        limit: 10,
      });

      console.log(chats);
    //   const chatId = chats.chat_ids[chatPos];

    //   const chatDetail = await client.api.getChat({
    //     chat_id: chatId,
    //   });

    //   const messages = await getChatHistory(client, chatId);
    //   console.log(messages.length, "messages");

    //   console.log("closing");
    //   await client.api.close({});
    //   console.log("closed");

    //   res.send({
    //     group: chatDetail,
    //     messages,
    //     success: true,
    //   });
    // } catch (error) {
    //   console.log(error);
    //   res.status(500).send({
    //     error: error.message,
    //   });
    // }
    } catch (err: any) {
        console.log(err)
        throw err
    }

    throw new Error("ending");

    // const query: youtube_v3.Params$Resource$Activities$List = {
    //     part: ["snippet", "contentDetails"],
    //     mine: true,
    //     maxResults: this.config.batchSize, // Google Docs: default = 5, max = 50
    // };

    // if (syncPosition.thisRef) {
    //     query.pageToken = syncPosition.thisRef;
    // }

    // const serverResponse = await youtube.activities.list(query);

    // if (
    //     !_.has(serverResponse, "data.items") ||
    //     !serverResponse.data.items.length
    // ) {
    //     // No results found, so stop sync
    //     syncPosition = this.stopSync(syncPosition);

    //     return {
    //         position: syncPosition,
    //         results: [],
    //     };
    // }

    // const results = await this.buildResults(
    //     youtube,
    //     serverResponse,
    //     syncPosition.breakId,
    //     _.has(this.config, "metadata.breakTimestamp")
    //         ? this.config.metadata.breakTimestamp
    //         : undefined
    // );

    // syncPosition = this.setNextPosition(syncPosition, serverResponse);

    // if (results.length != this.config.batchSize) {
    //     // Not a full page of results, so stop sync
    //     syncPosition = this.stopSync(syncPosition);
    // }

    // return {
    //     results,
    //     position: syncPosition,
    // };
  }

  protected stopSync(syncPosition: SyncHandlerPosition): SyncHandlerPosition {
    if (syncPosition.status == SyncHandlerStatus.STOPPED) {
      return syncPosition;
    }

    syncPosition.status = SyncHandlerStatus.STOPPED;
    syncPosition.thisRef = undefined;
    syncPosition.breakId = syncPosition.futureBreakId;
    syncPosition.futureBreakId = undefined;

    return syncPosition;
  }

  protected setNextPosition(
    syncPosition: SyncHandlerPosition,
    serverResponse: GaxiosResponse<youtube_v3.Schema$ActivityListResponse>
  ): SyncHandlerPosition {
    if (!syncPosition.futureBreakId && serverResponse.data.items.length) {
      syncPosition.futureBreakId = `${this.connection.profile.id}-${serverResponse.data.items[0].id}`;
    }

    if (_.has(serverResponse, "data.nextPageToken")) {
      // Have more results, so set the next page ready for the next request
      syncPosition.thisRef = serverResponse.data.nextPageToken;
    } else {
      syncPosition = this.stopSync(syncPosition);
    }

    return syncPosition;
  }

  protected async buildResults(
    youtube: youtube_v3.Youtube,
    serverResponse: GaxiosResponse<youtube_v3.Schema$ActivityListResponse>,
    breakId: string,
    breakTimestamp?: string
  ): Promise<SchemaFavourite[]> {
    const results: SchemaFavourite[] = [];

    const activities = serverResponse.data.items;
    // filter favourite(like, favourite, recommendation)
    const favourites = activities.filter((activity) =>
      [
        SchemaYoutubeActivityType.LIKE,
        SchemaYoutubeActivityType.FAVOURITE,
        SchemaYoutubeActivityType.RECOMMENDATION,
      ].includes(activity.snippet.type as SchemaYoutubeActivityType)
    );
    for (const favourite of favourites) {
      const favouriteId = `${this.connection.profile.id}-${favourite.id}`;

      if (favouriteId == breakId) {
        break;
      }

      const snippet = favourite.snippet;
      const insertedAt = snippet.publishedAt || "Unknown";

      if (breakTimestamp && insertedAt < breakTimestamp) {
        break;
      }

      const title = snippet.title || "No title";
      const description = snippet.description || "No description";
      const contentDetails = favourite.contentDetails;

      const activityType = snippet.type;
      const iconUri = snippet.thumbnails.default.url;
      // extract activity URI
      let activityUri = "";
      let videoId = "";
      switch (activityType) {
        case SchemaYoutubeActivityType.LIKE:
          videoId = contentDetails.like.resourceId.videoId;
          activityUri = "https://www.youtube.com/watch?v=" + videoId;
          break;
        case SchemaYoutubeActivityType.FAVOURITE:
          videoId = contentDetails.favorite.resourceId.videoId;
          activityUri = "https://www.youtube.com/watch?v=" + videoId;
          break;
        case SchemaYoutubeActivityType.RECOMMENDATION:
          videoId = contentDetails.recommendation.resourceId.videoId;
          activityUri = "https://www.youtube.com/watch?v=" + videoId;
          break;
        default:
          activityUri = "Unknown activity type";
          break;
      }

      results.push({
        _id: `youtube-${favouriteId}`,
        name: title,
        icon: iconUri,
        uri: activityUri,
        favouriteType: activityType as FavouriteType,
        contentType: ContentType.VIDEO,
        sourceData: snippet,
        sourceAccountId: this.provider.getProviderId(),
        sourceApplication: this.getProviderApplicationUrl(),
        insertedAt: insertedAt,
      });
    }

    return results;
  }
}
