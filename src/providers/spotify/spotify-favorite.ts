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
import { SchemaFavourite, SchemaFavouriteContentType, SchemaFavouriteType } from "../../schemas";
import { SpotifyHandlerConfig } from "./interfaces";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";
import BaseSyncHandler from "../BaseSyncHandler";
import { Client, UsersController } from "spotify-api-sdk";

const MAX_BATCH_SIZE = 50;

export default class SpotifyFavoriteHandler extends BaseSyncHandler {

    protected config: SpotifyHandlerConfig;

    public getLabel(): string {
        return "Spotify Favorite Tracks";
    }

    public getName(): string {
        return "spotify-favorites";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.FAVORITES;
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

    /**
     * Don't use pagination and Item range tracking here
     * 
     * @param client 
     * @param syncPosition 
     * @returns 
     */
    public async _sync(
        client: Client,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        const usersController = new UsersController(client);

        try {
            if (this.config.batchSize > MAX_BATCH_SIZE) {
                throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
            }

            // Fetch results for user's top tracks
            const response = await usersController.getUsersTopTracks("medium_term", this.config.batchSize);

            const result = await this.buildResults(response.result);
            const items = result.items;

            if (!items.length) {
                syncPosition.syncMessage = `Stopping. No results found.`;
                syncPosition.status = SyncHandlerStatus.ENABLED;
            } else {
                syncPosition.syncMessage = `Batch complete (${this.config.batchSize}). No more results.`;
            }

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
        response: any
    ): Promise<{ items: SchemaFavourite[] }> {
        const results: SchemaFavourite[] = [];

        for (const track of response.items ?? []) {
            const trackId = track.id;
            const name = track.name;  // Use track name
            const popularity = track.popularity ?? 0; 
            const uri = track.externalUrls?.spotify ?? '';
            const icon = track.album?.images?.[0]?.url ?? '';  // Use album art as icon

            results.push({
                _id: this.buildItemId(trackId),
                name: name,
                icon: icon,
                uri: uri,
                description: `Popularity: ${popularity}`,  
                favouriteType: SchemaFavouriteType.FAVOURITE,
                contentType: SchemaFavouriteContentType.AUDIO,
                sourceId: trackId,
                sourceData: track,
                sourceAccountId: this.provider.getAccountId(),
                sourceApplication: this.getProviderApplicationUrl(),
                insertedAt: new Date().toISOString(),
            });
        }

        return { items: results };
    }
}
