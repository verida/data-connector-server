import CONFIG from "../../config";
import {
    SyncHandlerPosition,
    SyncResponse,
    SyncHandlerStatus,
    ProviderHandlerOption
} from "../../interfaces";
import { SchemaPlaylist, SchemaPlaylistType, SchemaSpotifyTrack } from "../../schemas";
import { SpotifyHandlerConfig } from "./interfaces";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";
import BaseSyncHandler from "../BaseSyncHandler";
import { Client, PlaylistsController } from "spotify-api-sdk";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { Person } from "../google/interfaces";

export default class SpotifyPlaylistHandler extends BaseSyncHandler {

    protected config: SpotifyHandlerConfig;

    public getLabel(): string {
        return "Spotify Playlists";
    }

    public getName(): string {
        return "spotify-playlists";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.PLAYLIST;
    }

    public getProviderApplicationUrl(): string {
        return "https://spotify.com/";
    }

    public getOptions(): ProviderHandlerOption[] {
        return [];
    }

    public async _sync(
        client: Client,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        const playlistsController = new PlaylistsController(client);

        try {
            const limit = this.config.batchSize;

            const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
            let items: SchemaPlaylist[] = [];

            let currentRange = rangeTracker.nextRange();
            let offset = currentRange.startId ? currentRange.startId : '0';

            const response = await playlistsController.getAListOfCurrentUsersPlaylists(limit, parseInt(offset));

            const result = await this.buildResults(response.result.items);
            items = result.items;

            let nextOffset = response.result.offset + response.result.total;

            if (items.length) {
                rangeTracker.completedRange({
                    startId: offset.toString(),
                    endId: nextOffset?.toString(),
                }, false);
            } else {
                rangeTracker.completedRange({
                    startId: undefined,
                    endId: undefined,
                }, false);
            }

            currentRange = rangeTracker.nextRange();
            if (items.length != limit && currentRange.startId) {
                const backfillOffset = currentRange.startId;
                const backfillBatchSize = limit - items.length;

                const backfillResponse = await playlistsController.getAListOfCurrentUsersPlaylists(backfillBatchSize, parseInt(backfillOffset));
                const backfillResult = await this.buildResults(backfillResponse.result.items);
                items = items.concat(backfillResult.items);

                nextOffset = backfillResponse.result.offset + backfillResponse.result.limit;

                if (backfillResult.items.length) {
                    rangeTracker.completedRange({
                        startId: backfillOffset?.toString(),
                        endId: nextOffset?.toString(),
                    }, false);
                } else {
                    rangeTracker.completedRange({
                        startId: undefined,
                        endId: undefined,
                    }, false);
                }
            }

            if (!items.length) {
                syncPosition.syncMessage = `Stopping. No playlists found.`;
                syncPosition.status = SyncHandlerStatus.ENABLED;
            } else {
                if (items.length != limit && !nextOffset) {
                    syncPosition.syncMessage = `Processed ${items.length} playlists. Stopping. No more results.`;
                    syncPosition.status = SyncHandlerStatus.ENABLED;
                } else {
                    syncPosition.syncMessage = `Batch complete (${limit}). More results pending.`;
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
        items: any[]
    ): Promise<{ items: SchemaPlaylist[] }> {
        const results: SchemaPlaylist[] = [];

        for (const playlist of items) {
            const playlistId = playlist.id;
            const playlistName = playlist.name;
            const externalUrl = playlist.external_urls?.spotify ?? '';
            const icon = playlist.images?.[0]?.url ?? '';
            const owner: Person = playlist.owner;

            const tracks: SchemaSpotifyTrack[] = await this.getPlaylistTracks(playlist.tracks.href, this.connection.accessToken);

            results.push({
                _id: this.buildItemId(playlistId),
                sourceAccountId: this.provider.getAccountId(),
                sourceApplication: this.getProviderApplicationUrl(),
                sourceId: playlistId,
                sourceData: playlist,
                schema: CONFIG.verida.schemas.PLAYLIST,
                name: playlistName,
                icon: icon,
                uri: 'externalUrl',
                type: SchemaPlaylistType.AUDIO,
                tracks: tracks,
                owner: owner,
                insertedAt: new Date().toISOString()
            });
        }

        return { items: results };
    }

    private async getPlaylistTracks(playlistTracksUrl: string, accessToken: string): Promise<SchemaSpotifyTrack[]> {
        const response = await fetch(playlistTracksUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        
        return data.items.map((item: any) => {
            const track = item.track;
            return {
                id: track.id,
                title: track.name,               
                duration: track.duration_ms,                
                url: track.external_urls?.spotify ?? ''
            };
        });
    }
}
