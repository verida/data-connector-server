import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import { SyncProviderLogEvent, SyncProviderLogLevel, SyncHandlerPosition, SyncResponse, SyncHandlerStatus, SyncItemsBreak, ProviderHandlerOption, ConnectionOptionType } from "../../interfaces";
import { SchemaFollowing } from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";

const _ = require("lodash");

// Set MAX_BATCH_SIZE to 50 because the YouTube Data API v3 'maxResults' parameter is capped at 50.
// For more details, see: https://developers.google.com/youtube/v3/docs/search/list
const MAX_BATCH_SIZE = 50;

export default class YouTubeFollowing extends GoogleHandler {

    public getLabel(): string {
        return "Youtube Following"
    }

    public getName(): string {
        return "youtube-following";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.FOLLOWING;
    }

    public getProviderApplicationUrl(): string {
        return "https://youtube.com/";
    }

    public getYouTube(): youtube_v3.Youtube {
        const oAuth2Client = this.getGoogleAuth();
        return google.youtube({ version: "v3", auth: oAuth2Client });
    }

    public getOptions(): ProviderHandlerOption[] {
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

        let items: SchemaFollowing[] = [];

        // Fetch any new items
        let currentRange = rangeTracker.nextRange();
        let query: youtube_v3.Params$Resource$Subscriptions$List = {
            part: ["snippet"],
            mine: true,
            maxResults: this.config.batchSize,
        };

        if (currentRange.startId) {
            query.pageToken = currentRange.startId;
        }

        const latestResponse = await youtube.subscriptions.list(query);
        const latestResult = await this.buildResults(
            latestResponse,
            currentRange.endId
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

        currentRange = rangeTracker.nextRange();
        if (items.length != this.config.batchSize && currentRange.startId) {
            query = {
                part: ["snippet"],
                mine: true,
                maxResults: this.config.batchSize - items.length,
                pageToken: currentRange.startId
            };

            const backfillResponse = await youtube.subscriptions.list(query);
            const backfillResult = await this.buildResults(
                backfillResponse,
                currentRange.endId
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
        serverResponse: GaxiosResponse<youtube_v3.Schema$SubscriptionListResponse>,
        breakId: string
    ): Promise<{ items: SchemaFollowing[], breakHit?: SyncItemsBreak }> {
        const results: SchemaFollowing[] = [];
        let breakHit: SyncItemsBreak;
    
        for (const item of serverResponse.data.items ?? []) {
            const itemId = item.id ?? '';
    
            if (itemId === breakId) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break ID hit (${breakId})`
                };
                this.emit('log', logEvent);
                breakHit = SyncItemsBreak.ID;
                break;
            }
    
            const snippet = item.snippet ?? {};
            const insertedAt = snippet.publishedAt ?? new Date().toISOString();
    
            const title = snippet.title ?? 'No title';
            const description = snippet.description ?? 'No description';
            const uri = `https://www.youtube.com/channel/${snippet.resourceId?.channelId ?? ''}`;
            const icon = snippet.thumbnails?.default?.url ?? '';
    
            results.push({
                _id: this.buildItemId(itemId),
                name: title,
                icon: icon,
                uri: uri,
                description: description,
                sourceId: itemId,
                sourceData: snippet,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                followedTimestamp: insertedAt,
                insertedAt: insertedAt,
            });
        }
    
        return { items: results, breakHit };
    }    
}
