import CONFIG from "../../config";
import {
    SyncProviderLogEvent,
    SyncProviderLogLevel,
    SyncHandlerPosition,
    SyncResponse,
    SyncHandlerStatus,
    SyncItemsBreak,
    ProviderHandlerOption,
    ConnectionOptionType
} from "../../interfaces";
import { SchemaFollowing } from "../../schemas";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { SpotifyHandlerConfig } from "./interfaces";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";
import BaseSyncHandler from "../BaseSyncHandler";
import { Client, ItemType1Enum, UsersController } from "spotify-api-sdk";

const MAX_BATCH_SIZE = 50;

export default class SpotifyFollowing extends BaseSyncHandler {

    protected config: SpotifyHandlerConfig;

    public getLabel(): string {
        return "Spotify Followed Artists";
    }

    public getName(): string {
        return "spotify-following";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.FOLLOWING;
    }

    public getProviderApplicationUrl(): string {
        return "https://spotify.com/";
    }

    public getOptions(): ProviderHandlerOption[] {
        return [{
            id: 'backdate',
            label: 'Backdate history',
            type: ConnectionOptionType.ENUM,
            enumOptions: [{
                value: '1-month',
                label: '1 month'
            }, {
                value: '3-months',
                label: '3 months'
            }, {
                value: '6-months',
                label: '6 months'
            }, {
                value: '12-months',
                label: '12 months'
            }],
            defaultValue: '3-months'
        }];
    }

    public async _sync(
        client: Client,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        const usersController = new UsersController(client);

        try {
            if (this.config.batchSize > MAX_BATCH_SIZE) {
                throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
            }

            const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
            let items: SchemaFollowing[] = [];

            let currentRange = rangeTracker.nextRange();
            let offset = currentRange.startId ?? currentRange.startId;

            // Fetch initial results
            const response = await usersController.getFollowed(ItemType1Enum.Artist, offset, this.config.batchSize);

            const result = await this.buildResults(response.result, currentRange.endId);
            items = result.items;

            // Determine the next offset based on the cursor from the response
            let nextOffset = response.result.artists?.cursors?.after;

            if (items.length) {
                rangeTracker.completedRange({
                    startId: offset?.toString(),
                    endId: nextOffset,
                }, result.breakHit == SyncItemsBreak.ID);
            } else {
                rangeTracker.completedRange({
                    startId: undefined,
                    endId: undefined,
                }, false);
            }

            currentRange = rangeTracker.nextRange();
            if (items.length != this.config.batchSize && currentRange.startId) {
                const backfillOffset = currentRange.startId;
                const backfillBatchSize = this.config.batchSize - items.length;

                const backfillResponse = await usersController.getFollowed(ItemType1Enum.Artist, backfillOffset, backfillBatchSize);

                const backfillResult = await this.buildResults(backfillResponse.result, currentRange.endId);
                items = items.concat(backfillResult.items);

                nextOffset = backfillResponse.result.artists?.cursors?.after;

                if (backfillResult.items.length) {
                    rangeTracker.completedRange({
                        startId: backfillOffset?.toString(),
                        endId: nextOffset,
                    }, backfillResult.breakHit == SyncItemsBreak.ID);
                } else {
                    rangeTracker.completedRange({
                        startId: undefined,
                        endId: undefined,
                    }, backfillResult.breakHit == SyncItemsBreak.ID);
                }
            }

            if (!items.length) {
                syncPosition.syncMessage = `Stopping. No results found.`;
                syncPosition.status = SyncHandlerStatus.ENABLED;
            } else {
                if (items.length != this.config.batchSize && !nextOffset) {
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
        } catch (err: any) {
            if (err.response && err.response.status === 403) {
                throw new AccessDeniedError(err.message);
            } else if (err.response && err.response.status === 401) {
                throw new InvalidTokenError(err.message);
            }

            throw err;
        }
    }

    protected async buildResults(
        response: any,
        breakId: string
    ): Promise<{ items: SchemaFollowing[], breakHit?: SyncItemsBreak }> {
        const results: SchemaFollowing[] = [];
        let breakHit: SyncItemsBreak;

        for (const artist of response.artists?.items ?? []) {
            const artistId = artist.id;

            if (artistId === breakId) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break ID hit (${breakId})`
                };
                this.emit('log', logEvent);
                breakHit = SyncItemsBreak.ID;
                break;
            }

            const name = artist.name;
            const followers = artist.followers?.total ?? 0;
            const uri = artist.externalUrls?.spotify ?? '';
            const icon = artist.images?.[0]?.url ?? '';

            results.push({
                _id: this.buildItemId(artistId),
                name: name,
                icon: icon,
                uri: uri,
                description: `${followers} followers`,
                sourceId: artistId,
                sourceData: artist,
                sourceAccountId: this.provider.getAccountId(),
                sourceApplication: this.getProviderApplicationUrl(),
                followedTimestamp: new Date().toISOString(),
                insertedAt: new Date().toISOString(),
            });
        }

        return { items: results, breakHit };
    }
}
