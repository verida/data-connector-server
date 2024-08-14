import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import { SyncProviderLogEvent, SyncProviderLogLevel } from '../../interfaces'

import {
    SyncResponse,
    SyncHandlerPosition,
    SyncHandlerStatus,
} from "../../interfaces";
import { SchemaFollowing } from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";

const _ = require("lodash");

export default class YouTubeFollowing extends GoogleHandler {
    
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
        const oAuth2Client = this.getGoogleAuth()
        const youtube = google.youtube({ version: "v3", auth: oAuth2Client });
        return youtube;
    }

    public async _sync(
        api: any,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        const youtube = this.getYouTube();

        const query: youtube_v3.Params$Resource$Subscriptions$List = {
            part: ["snippet"],
            mine: true,
            maxResults: this.config.batchSize,
          };

        if (syncPosition.thisRef) {
            query.pageToken = syncPosition.thisRef;
        }

        const serverResponse = await youtube.subscriptions.list(query);

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

        // Sort items by publishedAt timestamp in descending order (most recent first)
        serverResponse.data.items.sort((a, b) => {
            const dateA = new Date(a.snippet.publishedAt).getTime();
            const dateB = new Date(b.snippet.publishedAt).getTime();
            return dateB - dateA;
        });

        const results = await this.buildResults(
            youtube,
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
        serverResponse: GaxiosResponse<youtube_v3.Schema$SubscriptionListResponse>
    ): SyncHandlerPosition {
        if (!syncPosition.futureBreakId && serverResponse.data.items.length) {
            syncPosition.futureBreakId = serverResponse.data.items[0].id;
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
        serverResponse: GaxiosResponse<youtube_v3.Schema$SubscriptionListResponse>,
        breakId: string,
        breakTimestamp?: string
    ): Promise<SchemaFollowing[]> {
        const results: SchemaFollowing[] = [];
        for (const item of serverResponse.data.items) {
            const itemId = item.id;

            if (itemId == breakId) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break ID hit (${breakId})`
                }
                this.emit('log', logEvent)
                break
            }

            const snippet = item.snippet;
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
            const uri = "https://www.youtube.com/channel/" + snippet.resourceId.channelId;
            const icon = snippet.thumbnails.default.url;

            results.push({
                _id: this.buildItemId(itemId),
                name: title,
                icon: icon,
                uri: uri,
                summary: description,
                sourceId: item.id,
                sourceData: snippet,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                followedTimestamp: insertedAt,
                insertedAt: insertedAt,
            });
        }

        return results;
    }
}
