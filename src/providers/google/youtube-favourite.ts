import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import { SyncHandlerPosition, SyncItemsBreak, SyncItemsResult, SyncProviderLogEvent, SyncProviderLogLevel } from '../../interfaces';
import {
    SyncResponse,
    SyncHandlerStatus,
    HandlerOption,
    ConnectionOptionType,
} from "../../interfaces";
import { SchemaFavouriteContentType, SchemaFavouriteType, SchemaFavourite } from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";

const _ = require("lodash");

const MAX_BATCH_SIZE = 50;

export interface SyncFavouriteItemsResult extends SyncItemsResult {
    items: SchemaFavourite[];
}

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
        const oAuth2Client = this.getGoogleAuth();
        const youtube = google.youtube({ version: "v3", auth: oAuth2Client });
        return youtube;
    }

    public getOptions(): HandlerOption[] {
        return [{
            name: 'backdate',
            label: 'Backdate history',
            type: ConnectionOptionType.ENUM,
            enumOptions: ['1 month', '3 months', '6 months', '12 months'],
            defaultValue: '3 months'
        }];
    }

    public async _sync(
        api: any,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        if (this.config.batchSize > MAX_BATCH_SIZE) {
            throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
        }

        const youtube = this.getYouTube();
        const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

        let items: SchemaFavourite[] = [];

        // Fetch any new items
        let currentRange = rangeTracker.nextRange();
        let query: youtube_v3.Params$Resource$Videos$List = {
            part: ["snippet", "contentDetails"],
            myRating: "like",
            maxResults: this.config.batchSize,
        };

        if (currentRange.startId) {
            query.pageToken = currentRange.startId;
        }

        const latestResponse = await youtube.videos.list(query);
        const latestResult = await this.buildResults(
            latestResponse,
            currentRange.endId,
            _.has(this.config, "metadata.breakTimestamp")
                ? this.config.metadata.breakTimestamp
                : undefined
        );

        items = latestResult.items;

        let nextPageToken = _.has(latestResponse, "data.nextPageToken") ? latestResponse.data.nextPageToken : undefined;

        if (items.length) {
            rangeTracker.completedRange({
                startId: items[0].sourceId,
                endId: nextPageToken
            }, latestResult.breakHit == SyncItemsBreak.ID);
        } else {
            rangeTracker.completedRange({
                startId: undefined,
                endId: undefined
            }, false);
        }

        if (items.length != this.config.batchSize) {
            currentRange = rangeTracker.nextRange();
            query = {
                part: ["snippet", "contentDetails"],
                myRating: "like",
                maxResults: this.config.batchSize - items.length,
            };

            if (currentRange.startId) {
                query.pageToken = currentRange.startId;
            }

            const backfillResponse = await youtube.videos.list(query);
            const backfillResult = await this.buildResults(
                backfillResponse,
                currentRange.endId,
                _.has(this.config, "metadata.breakTimestamp")
                    ? this.config.metadata.breakTimestamp
                    : undefined
            );

            items = items.concat(backfillResult.items);
            nextPageToken = _.has(backfillResponse, "data.nextPageToken") ? backfillResponse.data.nextPageToken : undefined;

            if (backfillResult.items.length) {
                rangeTracker.completedRange({
                    startId: backfillResult.items[0].sourceId,
                    endId: nextPageToken
                }, backfillResult.breakHit == SyncItemsBreak.ID);
            } else {
                rangeTracker.completedRange({
                    startId: undefined,
                    endId: undefined
                }, backfillResult.breakHit == SyncItemsBreak.ID);
            }
        }

        if (!items.length) {
            syncPosition.syncMessage = `Stopping. No results found.`;
            syncPosition.status = SyncHandlerStatus.ENABLED;
        } else {
            if (items.length != this.config.batchSize && !nextPageToken) {
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

    protected async buildResults(
        serverResponse: GaxiosResponse<youtube_v3.Schema$VideoListResponse>,
        breakId: string,
        breakTimestamp?: string
    ): Promise<SyncFavouriteItemsResult> {
        const results: SchemaFavourite[] = [];
        let breakHit: SyncItemsBreak;

        for (const video of serverResponse.data.items) {
            const videoId = video.id;
            const favouriteId = videoId;

            if (favouriteId == breakId) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break ID hit (${breakId})`
                };
                this.emit('log', logEvent);
                breakHit = SyncItemsBreak.ID;
                break;
            }

            const snippet = video.snippet;
            const insertedAt = snippet.publishedAt || "Unknown";

            if (breakTimestamp && insertedAt < breakTimestamp) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break timestamp hit (${breakTimestamp})`
                };
                this.emit('log', logEvent);
                breakHit = SyncItemsBreak.TIMESTAMP;
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

        return {
            items: results,
            breakHit,
        };
    }
}
