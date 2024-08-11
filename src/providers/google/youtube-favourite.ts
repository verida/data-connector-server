import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";

import {
    SyncResponse,
    SyncHandlerPosition,
    SyncHandlerStatus,
} from "../../interfaces";
import { ContentType, FavouriteType, SchemaFavourite, SchemaYoutubeActivityType } from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";

const _ = require("lodash");

export default class YouTubeFavourite extends GoogleHandler {

    public getName(): string {
        return "youtube-favourite";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.FAVOURITE;
    }

    public getProviderApplicationUrl(): string {
        return "https://youtube.com/";
    }

    public getYouTube(): youtube_v3.Youtube {
        const oAuth2Client = this.getGoogleAuth()
        const youtube = google.youtube({ version: "v3", auth: oAuth2Client });
        return youtube;
    }

    public async _sync(
        api: any,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        const youtube = this.getYouTube();
    
        const query: youtube_v3.Params$Resource$Videos$List = {
            part: ["snippet", "contentDetails"],
            myRating: "like",
            maxResults: this.config.batchSize, // Google Docs: default = 5, max = 50
        };
    
        if (syncPosition.thisRef) {
            query.pageToken = syncPosition.thisRef;
        }
    
        const serverResponse = await youtube.videos.list(query);
    
        if (
            !_.has(serverResponse, "data.items") ||
            !serverResponse.data.items.length
        ) {
            // No results found, so stop sync
            syncPosition = this.stopSync(syncPosition);
    
            return {
                position: syncPosition,
                results: [],
            };
        }
    
        const results = await this.buildResults(
            serverResponse,
            syncPosition.breakId,
            _.has(this.config, "metadata.breakTimestamp")
                ? this.config.metadata.breakTimestamp
                : undefined
        );
    
        syncPosition = this.setNextPosition(syncPosition, serverResponse);
    
        if (results.length != this.config.batchSize) {
            // Not a full page of results, so stop sync
            syncPosition = this.stopSync(syncPosition);
        }
    
        return {
            results,
            position: syncPosition,
        };
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
        serverResponse: GaxiosResponse<youtube_v3.Schema$VideoListResponse>
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
        serverResponse: GaxiosResponse<youtube_v3.Schema$VideoListResponse>,
        breakId: string,
        breakTimestamp?: string
    ): Promise<SchemaFavourite[]> {
        const results: SchemaFavourite[] = [];
    
        const videos = serverResponse.data.items;
    
        for (const video of videos) {
            const videoId = video.id;
            const favouriteId = `${this.connection.profile.id}-${videoId}`;
    
            if (favouriteId == breakId) {
                break;
            }
    
            const snippet = video.snippet;
            const insertedAt = snippet.publishedAt || "Unknown";
    
            if (breakTimestamp && insertedAt < breakTimestamp) {
                break;
            }
    
            const title = snippet.title || "No title";
            const description = snippet.description || "No description";
            const iconUri = snippet.thumbnails.default.url;
            const activityUri = `https://www.youtube.com/watch?v=${videoId}`;
    
            results.push({
                _id: this.buildItemId(favouriteId),
                name: title,
                icon: iconUri,
                description: description,
                uri: activityUri,
                favouriteType: FavouriteType.LIKE,
                contentType: ContentType.VIDEO,
                sourceId: favouriteId,
                sourceData: snippet,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                insertedAt: insertedAt,
            });
        }
    
        return results;
    }
    
}
