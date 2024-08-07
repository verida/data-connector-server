import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";

import {
    SyncResponse,
    SyncHandlerPosition,
    SyncHandlerStatus,
} from "../../interfaces";
import { SchemaPost } from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";

const _ = require("lodash");

export default class YouTubePost extends BaseSyncHandler {
    
    public getName(): string {
        return "youtube-post";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.POST;
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

        const query: youtube_v3.Params$Resource$Activities$List = {
            part: ["snippet", "contentDetails"],
            mine: true,
            maxResults: this.config.batchSize, // Google Docs: default = 5, max = 50
        };

        if (syncPosition.thisRef) {
            query.pageToken = syncPosition.thisRef;
        }

        const serverResponse = await youtube.activities.list(query);

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
        serverResponse: GaxiosResponse<youtube_v3.Schema$ActivityListResponse>
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
        serverResponse: GaxiosResponse<youtube_v3.Schema$ActivityListResponse>,
        breakId: string,
        breakTimestamp?: string
    ): Promise<SchemaPost[]> {
        const results: SchemaPost[] = [];
        for (const item of serverResponse.data.items) {
            const itemId = `${this.connection.profile.id}-${item.id}`;

            if (itemId == breakId) {
                break;
            }

            const snippet = item.snippet;
            const insertedAt = snippet.publishedAt || "Unknown";

            if (breakTimestamp && insertedAt < breakTimestamp) {
                break;
            }

            const title = snippet.title || "No title";
            const description = snippet.description || "No description";
            const contentDetails = item.contentDetails;

            const activityType = snippet.type;
            const iconUri = snippet.thumbnails.default.url;
            // extract activity URI
            let activityUri = "";
            switch (activityType) {
                case 'upload':
                  var videoId = contentDetails.upload.videoId;
                  activityUri = 'https://www.youtube.com/watch?v=' + videoId;
                  break;
                case 'like':
                  var videoId = contentDetails.like.resourceId.videoId;
                  activityUri = 'https://www.youtube.com/watch?v=' + videoId;
                  break;
                case 'comment':
                  var videoId = contentDetails.comment.resourceId.videoId;
                  activityUri = 'https://www.youtube.com/watch?v=' + videoId;
                  break;
                case 'subscription':
                  var channelId = contentDetails.subscription.resourceId.channelId;
                  activityUri = 'https://www.youtube.com/channel/' + channelId;
                  break;
                case 'playlistItem':
                  var playlistId = contentDetails.playlistItem.playlistId;
                  activityUri = 'https://www.youtube.com/playlist?list=' + playlistId;
                  break;
                default:
                  activityUri = 'Unknown activity type';
                  break;
              }


            results.push({
                _id: `youtube-${itemId}`,
                name: title,
                icon: iconUri,
                uri: activityUri,
                type: activityType,
                content: description,
                sourceData: snippet,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                insertedAt: insertedAt,
            });
        }

        return results;
    }
}
