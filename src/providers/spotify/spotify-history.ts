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
import { SchemaHistory, SchemaHistoryActivityType } from "../../schemas"; 
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { SpotifyHandlerConfig } from "./interfaces";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";
import BaseSyncHandler from "../BaseSyncHandler";
import { Client, PlayerController } from "spotify-api-sdk";

const MAX_BATCH_SIZE = 50;

export default class SpotifyPlayHistory extends BaseSyncHandler {

    protected config: SpotifyHandlerConfig;

    public getLabel(): string {
        return "Spotify Play History";
    }

    public getName(): string {
        return "spotify-history";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.HISTORY;
    }

    public getProviderApplicationUrl(): string {
        return "https://spotify.com/";
    }

    public getOptions(): ProviderHandlerOption[] {
        return [{
            id: 'backdate',
            label: 'Backdate history',
            type: ConnectionOptionType.ENUM,
            enumOptions: [
                { value: '1-month', label: '1 month' },
                { value: '3-months', label: '3 months' },
                { value: '6-months', label: '6 months' },
                { value: '12-months', label: '12 months' }
            ],
            defaultValue: '3-months'
        }];
    }

    public async _sync(
        client: Client,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        const playerController = new PlayerController(client);

        try {
            if (this.config.batchSize > MAX_BATCH_SIZE) {
                throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
            }

            const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
            let items: SchemaHistory[] = [];

            // Timestamp based 
            let currentRange = rangeTracker.nextRange();
            let offset = currentRange.startId ?? 0;

            const response = await playerController.getRecentlyPlayed(this.config.batchSize, BigInt(offset));

            const result = await this.buildResults(response.result.items, currentRange.endId);
            items = result.items;

            let nextOffset = response.result.cursors?.after;

            if (items.length) {
                rangeTracker.completedRange({
                    startId: offset?.toString(),
                    endId: nextOffset?.toString(),
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

                const backfillResponse = await playerController.getRecentlyPlayed(backfillBatchSize, BigInt(backfillOffset));
                const backfillResult = await this.buildResults(backfillResponse.result.items, currentRange.endId);
                items = items.concat(backfillResult.items);

                nextOffset = backfillResponse.result.cursors?.after;

                if (backfillResult.items.length) {
                    rangeTracker.completedRange({
                        startId: backfillOffset?.toString(),
                        endId: nextOffset?.toString(),
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
            if (err.response) {
                if (err.response.status === 403) {
                    throw new AccessDeniedError(err.message);
                } else if (err.response.status === 401) {
                    throw new InvalidTokenError(err.message);
                }
                throw new Error(`Unexpected error: ${err.response.status}`);
            }
            throw err; // Re-throw non-HTTP errors
        }
    }

    protected async buildResults(
        items: any[],
        breakTimeStamp: string
    ): Promise<{ items: SchemaHistory[], breakHit?: SyncItemsBreak }> {
        const results: SchemaHistory[] = [];
        let breakHit: SyncItemsBreak;

        for (const playHistory of items) {
            const trackId = playHistory.track.id;
            if (!trackId) {
                console.warn('Missing track ID:', playHistory.track);
                continue;
            }

            const playedAt = playHistory.playedAt   
            
            if (breakTimeStamp && playedAt <= new Date(breakTimeStamp).toISOString()) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break timestamp hit (${new Date(breakTimeStamp).toISOString()})`
                };
                this.emit('log', logEvent);
                breakHit = SyncItemsBreak.TIMESTAMP;
                break;
            }

            const trackName = playHistory.track.name || 'Unknown Track';            
            const durationMs = playHistory.track.durationMs || 0;
            const artists = playHistory.track.artists?.map((artist: any) => artist?.name || 'Unknown Artist').join(", ") || 'Unknown Artist';
            const uri = playHistory.track.externalUrls?.spotify || playHistory.track.uri || '';
            const icon = playHistory.track.album?.images?.[0]?.url || '';
        
            results.push({
                _id: this.buildItemId(trackId),
                name: `${trackName} by ${artists}`,
                icon: icon,
                url: uri,
                sourceId: trackId,
                sourceData: playHistory.track,
                sourceAccountId: this.provider.getAccountId(),
                sourceApplication: this.getProviderApplicationUrl(),
                insertedAt: new Date().toISOString(),
                timestamp: playedAt,
                duration: Number(durationMs) / 1000,
                activityType: SchemaHistoryActivityType.LISTENING
            });
           
        }

        return { items: results, breakHit };
    }
}

