import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";

import {
    SyncResponse,
    SyncHandlerPosition,
    SyncHandlerStatus,
} from "../../interfaces";
import { SchemaFollowing } from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";

const _ = require("lodash");

export default class YouTubeFollowing extends BaseSyncHandler {
    
    public getName(): string {
        return "youtube-following";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.FOLLOWING;
    }

    public getProviderApplicationUrl(): string {
        return "https://youtube.com";
    }

    public getYouTube(): youtube_v3.Youtube {
        const TOKEN = {
            access_token: this.connection.accessToken,
            refresh_token: this.connection.refreshToken,
            scope: "https://www.googleapis.com/auth/youtube.readonly",
            token_type: "Bearer",
        };

        const redirectUrl = "";

        const oAuth2Client = new google.auth.OAuth2(
            this.config.clientId,
            this.config.clientSecret,
            redirectUrl
        );

        oAuth2Client.setCredentials(TOKEN);

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
        youtube: youtube_v3.Youtube,
        serverResponse: GaxiosResponse<youtube_v3.Schema$SubscriptionListResponse>,
        breakId: string,
        breakTimestamp?: string
    ): Promise<SchemaFollowing[]> {
        const results: SchemaFollowing[] = [];
        for (const item of serverResponse.data.items) {
            const itemId = `${this.connection.profile.id}-${item.id}`;

            if (itemId == breakId) {
                break;
            }

            const snippet = item.snippet;
            const contentDetails = item.contentDetails;
            const insertedAt = snippet.publishedAt || "Unknown";

            if (breakTimestamp && insertedAt < breakTimestamp) {
                break;
            }

            const title = snippet.title || "No title";

            results.push({
                _id: `youtube-following-${itemId}`,
                name: title,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                insertedAt: insertedAt,
            });
        }

        return results;
    }
}
