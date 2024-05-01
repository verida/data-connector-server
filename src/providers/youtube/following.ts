import BaseSyncHandler from "../BaseSyncHandler";
import { SyncSchemaConfig } from "../BaseProvider";
const { google } = require("googleapis");

export default class Following extends BaseSyncHandler {
  protected static schemaUri: string =
    "https://common.schemas.verida.io/social/following/v0.1.0/schema.json";

  /**
   * Syncs the YouTube subscriptions of the user.
   * @param api Authenticated YouTube API client
   * @param syncConfig Configuration for syncing
   */
  public async sync(api: any, syncConfig: SyncSchemaConfig = {}): Promise<any> {
    const youtube = api;
    const subscriptions: any[] = [];
    const now = new Date().toISOString();

    try {
      let pageToken = "";
      do {
        const response = await youtube.subscriptions.list({
          part: "snippet",
          mine: true,
          maxResults: 50,
          pageToken: pageToken,
        });

        for (const item of response.data.items) {
          const subscriptionEntry = {
            _id: `youtube-${item.snippet.resourceId.channelId}`,
            name: item.snippet.title,
            icon: item.snippet.thumbnails.default.url,
            summary: `YouTube channel subscription: ${item.snippet.title}`,
            sourceApplication: "https://www.youtube.com/",
            sourceId: item.snippet.resourceId.channelId,
            insertedAt: now,
          };
          subscriptions.push(subscriptionEntry);
        }

        pageToken = response.data.nextPageToken || "";
      } while (
        pageToken &&
        (!syncConfig.limit || subscriptions.length < syncConfig.limit)
      );
    } catch (error) {
      console.error("Failed to sync YouTube subscriptions:", error);
      throw error;
    }

    return subscriptions;
  }
}
