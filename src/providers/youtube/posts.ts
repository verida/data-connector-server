import BaseSyncHandler from "../BaseSyncHandler";
import { SyncSchemaConfig } from "../BaseProvider";
import dayjs from "dayjs";

export default class Posts extends BaseSyncHandler {
  protected static schemaUri: string = "https://common.schemas.verida.io/social/post/v0.1.0/schema.json";

  /**
   * Syncs the YouTube subscriptions of the user.
   * @param api Authenticated YouTube API client
   * @param syncConfig Configuration for syncing
   */
  public async sync(api: any, syncConfig: SyncSchemaConfig = { limit: 20, sinceId: "" }): Promise<any> {
    const youtube = api;
    const posts: any[] = [];

    try {
      let pageToken = syncConfig.sinceId;
      do {
        const response = await youtube.search.list({
          part: "snippet",
          forMine: true,
          maxResults: Math.max(0, Math.min(20, syncConfig.limit - posts.length)),
          pageToken: pageToken,
          type: "video",
        });

        for (const item of response.data.items) {
          const sourceData = item;
          const createdAt = dayjs(item.snippet.publishedAt).toISOString();

          const videoEntry = {
            _id: `youtube-${item.id.videoId}`,
            name: item.snippet.title,
            icon: item.snippet.thumbnails.default.url,
            summary: `${item.snippet.title}`,
            sourceApplication: "https://www.youtube.com/",
            sourceId: item.snippet.channelId,
            sourceData,
            insertedAt: createdAt,
          };
          posts.push(videoEntry);
        }

        pageToken = response.data.nextPageToken || "";
      } while (pageToken && (!syncConfig.limit || posts.length < syncConfig.limit));
    } catch (error) {
      console.error("Failed to sync YouTube videos:", error);
      throw error;
    }

    return posts;
  }
}
