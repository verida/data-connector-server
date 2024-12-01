import CONFIG from "../../config";
import {
    SyncProviderLogEvent,
    SyncProviderLogLevel,
    SyncHandlerPosition,
    SyncResponse,
    SyncHandlerStatus,
    ProviderHandlerOption,
    ConnectionOptionType
} from "../../interfaces";
import { SchemaPlaylist, SchemaPlaylistType, SchemaSpotifyTrack } from "../../schemas";
import { SpotifyHandlerConfig } from "./interfaces";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";
import BaseSyncHandler from "../BaseSyncHandler";
import { Client, PlaylistsController } from "spotify-api-sdk";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";

const MAX_BATCH_SIZE = 50;

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
            let offset = currentRange.startId ?? currentRange.startId;
            const response = await playlistsController.getAListOfCurrentUsersPlaylists(limit, parseInt(offset));

            const result = await this.buildResults(response.result.items);
            items = result.items;

            let nextOffset = response.result.offset + response.result.limit;

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
            const description = playlist.description || '';
            const collaborative = playlist.collaborative;
            const externalUrl = playlist.external_urls?.spotify ?? '';
            const href = playlist.href ?? '';
            const icon = playlist.images?.[0]?.url ?? '';
            
            const tracks: SchemaSpotifyTrack[] = playlist.tracks.items.map((track: any) => {
                return {
                    id: track.track.id,
                    title: track.track.name,
                    artist: track.track.artists.map((artist: any) => artist.name).join(", "),
                    album: track.track.album.name,
                    thumbnail: track.track.album.images?.[0]?.url ?? '',
                    url: track.track.external_urls?.spotify ?? '',
                    type: SchemaPlaylistType.AUDIO, // Default to audio, or update if needed for videos
                };
            });

            results.push({
                _id: this.buildItemId(playlistId),
                name: playlistName,
                icon: icon,
                uri: externalUrl,
                type: SchemaPlaylistType.AUDIO,
                tracks: tracks,
                owner: undefined
            });
        }

        return { items: results };
    }
}
