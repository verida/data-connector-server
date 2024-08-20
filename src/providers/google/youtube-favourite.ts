import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import { SyncProviderLogEvent, SyncProviderLogLevel } from '../../interfaces'
import {
    SyncResponse,
    SyncHandlerPosition,
    SyncHandlerStatus,
} from "../../interfaces";
import { SchemaFavouriteContentType, SchemaFavouriteType, SchemaFavourite } from "../../schemas";
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
            syncPosition.syncMessage = "Stopping. No results found.";
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
            syncPosition.syncMessage = `Processed ${results.length} items. Stopping. No more results.`;
            syncPosition = this.stopSync(syncPosition);
        }
    
        return {
            results,
            position: syncPosition,
        };
    }
    
    protected stopSync(syncPosition: SyncHandlerPosition): SyncHandlerPosition {
        if (syncPosition.status == SyncHandlerStatus.ENABLED) {
            return syncPosition;
        }

        syncPosition.status = SyncHandlerStatus.ENABLED;
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
            syncPosition.futureBreakId = serverResponse.data.items[0].id;
        }

        if (_.has(serverResponse, "data.nextPageToken")) {
            // Have more results, so set the next page ready for the next request
            syncPosition.syncMessage = `Batch complete (${this.config.batchSize}). More results pending.`;
            syncPosition.thisRef = serverResponse.data.nextPageToken;
        } else {
            syncPosition.syncMessage = "Stopping. No more results.";
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
            const favouriteId = videoId;
    
            if (favouriteId == breakId) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break ID hit (${breakId})`
                }
                this.emit('log', logEvent)
                break;
            }
    
            const snippet = video.snippet;
            const insertedAt = snippet.publishedAt || "Unknown";
    
            if (breakTimestamp && insertedAt < breakTimestamp) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break timestamp hit (${breakTimestamp})`
                }
                this.emit('log', logEvent)
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
                uri: activityUri,
                // summary: description.substring(0, 256),
                description: description,
                favouriteType: SchemaFavouriteType.LIKE,
                contentType: SchemaFavouriteContentType.VIDEO,
                sourceId: videoId,
                sourceData: snippet,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                insertedAt: insertedAt,
            });
        }
    
        return results;
    }
    
}
