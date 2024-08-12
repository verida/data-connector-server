import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";

import {
  SyncResponse,
  SyncHandlerPosition,
  SyncHandlerStatus,
  HandlerOption,
  ConnectionOptionType,
} from "../../interfaces";
import {
  ContentType,
  FavouriteType,
  SchemaChatMessageType,
  SchemaFavourite,
  SchemaSocialChatGroup,
  SchemaSocialChatMessage,
  SchemaYoutubeActivityType,
} from "../../schemas";
import { google, youtube_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { TelegramApi } from "./api";
import { TelegramChatGroupBacklog, TelegramChatGroupType, TelegramConfig } from "./interfaces";
import config from "../../config";

const _ = require("lodash");

export default class TelegramChatMessageHandler extends BaseSyncHandler {
  protected config: TelegramConfig

  public getName(): string {
    return "chat-message";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.CHAT_MESSAGE;
  }

  public getProviderApplicationUrl(): string {
    return "https://telegram.com";
  }

  public getOptions(): HandlerOption[] {
    return [{
      name: 'groupTypes',
      label: 'Group types',
      type: ConnectionOptionType.ENUM_MULTI,
      enumOptions: [TelegramChatGroupType.BASIC, TelegramChatGroupType.PRIVATE, TelegramChatGroupType.SECRET, TelegramChatGroupType.SUPERGROUP],
      // Exclude super groups by default
      defaultValue: [TelegramChatGroupType.BASIC, TelegramChatGroupType.PRIVATE, TelegramChatGroupType.SECRET].join(',')
    }]
  }

  public async _sync(
    api: TelegramApi,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    // syncPosition.thisRef = groupIds
    // syncPosition.futureBreakId = unused

    // --/.....---------------/.....---------------
    // first:last,first:last,
    // 0-first,last-first,last-limit
    // ../..................../.....---------------
    // first,last

    try {
      let chatGroupIds: string[] = []
      if (syncPosition.thisRef) {
        // Load chat group list from current sync position
        chatGroupIds = syncPosition.thisRef.split(',')
      }

      // Fetch all the latest chat groups, up to group limit
      const latestChatGroupIds = await api.getChatGroupIds(this.config.groupLimit)

      // Append the chat group list with any new chat groups so we don't miss any
      for (const groupId of latestChatGroupIds) {
        if (chatGroupIds.indexOf(groupId) === -1) {
          chatGroupIds.push(groupId)
        }
      }

      // Build chat group data for each group ID
      const chatGroupResults = await this.buildChatGroupResults(api, chatGroupIds)

      // Build a list of chat groups to process that includes the newest / oldest
      // IDs from the database, if they exist
      let chatGroupsBacklog: SchemaSocialChatGroup[] = []
      if (this.config.useDbPos) {
        const chatGroupDs = await this.provider.getDatastore(CONFIG.verida.schemas.CHAT_GROUP)
        const chatGroupDbItems = <SchemaSocialChatGroup[]> await chatGroupDs.getMany({}, {
          limit: this.config.groupLimit
        })
        for (const chatItem of chatGroupDbItems) {
          if (chatGroupResults[chatItem._id]) {
            chatGroupResults[chatItem._id].newestId = chatItem.newestId
            chatGroupResults[chatItem._id].backlogIds = chatItem.backlogIds
          } else {
            chatGroupResults[chatItem._id] = chatItem
          }

          chatGroupsBacklog.push(chatGroupResults[chatItem._id])
        }
      } else {
        chatGroupsBacklog = Object.values(chatGroupResults)
      }

      let groupCount = 0
      const chatHistory: SchemaSocialChatMessage[] = []
      const chatGroups: SchemaSocialChatGroup[] = []

      // Process each chat group
      for (const chatGroup of chatGroupsBacklog) {
        let messageCount = 0
        let groupBacklog: TelegramChatGroupBacklog[] = []
        if (chatGroup.backlogIds) {
          const backlogItems = chatGroup.backlogIds.split(',')
          for (const item of backlogItems) {
            const [ startId, endId ] = item.split(':')
            groupBacklog.push[{
              startId,
              endId
            }]
          }
        }

        // Respect group limit
        if (groupCount++ > this.config.groupLimit) {
          break
        }

        // Fetch messages from now up until the newest
        const newestId = chatGroup.newestId ? parseInt(chatGroup.newestId) : undefined
        const oldestId = chatGroup.oldestId ? parseInt(chatGroup.oldestId) : undefined
        const recentGroupMessageList = await api.getChatHistory(parseInt(chatGroup.sourceId!), this.config.messageBatchSize, undefined, newestId)
        for (const messageData of recentGroupMessageList) {
          // Respect message limit
          // @todo use messageMaxAgeDays
          if (messageCount >= this.config.messageLimit) {
            break
          }

          const message = this.buildMessage(messageData, chatGroup._id)
          chatHistory.push(message)
          messageCount++
        }

        if (messageCount < this.config.messageLimit) {
          // Fetch messages from the last, up until the message limit
          const oldGroupMessageList = await api.getChatHistory(parseInt(chatGroup.sourceId!), this.config.messageBatchSize, oldestId)

          for (const messageData of oldGroupMessageList) {
            // Respect message limit
            if (messageCount >= this.config.messageLimit) {
              break
            }
  
            const message = this.buildMessage(messageData, chatGroup._id)
            chatHistory.push(message)
            messageCount++
          }
        }

        if (chatHistory.length) {
          chatGroup.oldestId = chatHistory[chatHistory.length-1]._id
          chatGroup.newestId = chatHistory[0]._id
        }

        // Include this chat group in the list of processed groups to save
        chatGroups.push(chatGroup)
      }

      // Update sync position to have a list of the next set of groups to process
      const nextBatchGroupIds = chatGroupIds.splice(0, groupCount)
      syncPosition.thisRef = nextBatchGroupIds.join(',')

      return {
        results: Object.values(chatGroupResults).concat(chatHistory),
        position: syncPosition
      }

      //const chatHistory = await api.getChatHistory(chats[0], 3)
      // id = id
      // is_outgoing = isOutgoing
      // sender_id.user_id = senderId
      // date = unix timestamp?
      // message_thread_id = ??
      // content.text._ = 'formattedText'
      // content.text.text = content -- how is markdown / formatting handled?


      // console.log(chatDetail)
      // console.log('---')

    //   const chatId = chats.chat_ids[chatPos];

    //   const chatDetail = await client.api.getChat({
    //     chat_id: chatId,
    //   });

    //   const messages = await getChatHistory(client, chatId);
    //   console.log(messages.length, "messages");

    //   console.log("closing");
    //   await client.api.close({});
    //   console.log("closed");

    //   res.send({
    //     group: chatDetail,
    //     messages,
    //     success: true,
    //   });
    // } catch (error) {
    //   console.log(error);
    //   res.status(500).send({
    //     error: error.message,
    //   });
    // }
    } catch (err: any) {
        console.log(err)
        throw err
    }

    throw new Error("ending");

    // const query: youtube_v3.Params$Resource$Activities$List = {
    //     part: ["snippet", "contentDetails"],
    //     mine: true,
    //     maxResults: this.config.batchSize, // Google Docs: default = 5, max = 50
    // };

    // if (syncPosition.thisRef) {
    //     query.pageToken = syncPosition.thisRef;
    // }

    // const serverResponse = await youtube.activities.list(query);

    // if (
    //     !_.has(serverResponse, "data.items") ||
    //     !serverResponse.data.items.length
    // ) {
    //     // No results found, so stop sync
    //     syncPosition = this.stopSync(syncPosition);

    //     return {
    //         position: syncPosition,
    //         results: [],
    //     };
    // }

    // const results = await this.buildResults(
    //     youtube,
    //     serverResponse,
    //     syncPosition.breakId,
    //     _.has(this.config, "metadata.breakTimestamp")
    //         ? this.config.metadata.breakTimestamp
    //         : undefined
    // );

    // syncPosition = this.setNextPosition(syncPosition, serverResponse);

    // if (results.length != this.config.batchSize) {
    //     // Not a full page of results, so stop sync
    //     syncPosition = this.stopSync(syncPosition);
    // }

    // return {
    //     results,
    //     position: syncPosition,
    // };
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
  ): Promise<SchemaFavourite[]> {
    const results: SchemaFavourite[] = [];

    const activities = serverResponse.data.items;
    // filter favourite(like, favourite, recommendation)
    const favourites = activities.filter((activity) =>
      [
        SchemaYoutubeActivityType.LIKE,
        SchemaYoutubeActivityType.FAVOURITE,
        SchemaYoutubeActivityType.RECOMMENDATION,
      ].includes(activity.snippet.type as SchemaYoutubeActivityType)
    );
    for (const favourite of favourites) {
      const favouriteId = `${this.connection.profile.id}-${favourite.id}`;

      if (favouriteId == breakId) {
        break;
      }

      const snippet = favourite.snippet;
      const insertedAt = snippet.publishedAt || "Unknown";

      if (breakTimestamp && insertedAt < breakTimestamp) {
        break;
      }

      const title = snippet.title || "No title";
      const description = snippet.description || "No description";
      const contentDetails = favourite.contentDetails;

      const activityType = snippet.type;
      const iconUri = snippet.thumbnails.default.url;
      // extract activity URI
      let activityUri = "";
      let videoId = "";
      switch (activityType) {
        case SchemaYoutubeActivityType.LIKE:
          videoId = contentDetails.like.resourceId.videoId;
          activityUri = "https://www.youtube.com/watch?v=" + videoId;
          break;
        case SchemaYoutubeActivityType.FAVOURITE:
          videoId = contentDetails.favorite.resourceId.videoId;
          activityUri = "https://www.youtube.com/watch?v=" + videoId;
          break;
        case SchemaYoutubeActivityType.RECOMMENDATION:
          videoId = contentDetails.recommendation.resourceId.videoId;
          activityUri = "https://www.youtube.com/watch?v=" + videoId;
          break;
        default:
          activityUri = "Unknown activity type";
          break;
      }

      results.push({
        _id: `youtube-${favouriteId}`,
        name: title,
        icon: iconUri,
        uri: activityUri,
        favouriteType: activityType as FavouriteType,
        contentType: ContentType.VIDEO,
        sourceData: snippet,
        sourceAccountId: this.provider.getProviderId(),
        sourceApplication: this.getProviderApplicationUrl(),
        insertedAt: insertedAt,
      });
    }

    return results;
  }

  protected buildMessage(rawMessage: any, chatGroupId: string): SchemaSocialChatMessage {
    const timestamp = (new Date(rawMessage.date * 1000)).toString()

    console.log(rawMessage)

    const message: SchemaSocialChatMessage = {
      _id: `${this.provider.getProviderName()}-${this.connection.profile.id}-${rawMessage.id}`,
      name: rawMessage.content.text.text.substring(0,30),
      chatGroupId,
      type: rawMessage.is_outgoing ? SchemaChatMessageType.SEND : SchemaChatMessageType.SEND,
      senderId: rawMessage.sender_id.user_id.toString(),
      messageText: rawMessage.content.text.text,
      insertedAt: timestamp,
      sentAt: timestamp
    }

    console.log(message)

    // id = id
      // is_outgoing = isOutgoing
      // sender_id.user_id = senderId
      // date = unix timestamp?
      // message_thread_id = ??
      // content.text._ = 'formattedText'
      // content.text.text = content -- how is markdown / formatting handled?

    return message
  }

  protected async buildChatGroupResults(api: TelegramApi, chatGroupIds: string[]): Promise<Record<number, SchemaSocialChatGroup>> {
    const results: Record<number, SchemaSocialChatGroup> = {}

    for (const groupId of chatGroupIds) {
      const groupDetails = await api.getChatGroup(parseInt(groupId))

      const item: SchemaSocialChatGroup = {
        _id: `${this.provider.getProviderName()}-${this.connection.profile.id}-${groupId.toString()}`,
        sourceId: groupId.toString(),
        schema: CONFIG.verida.schemas.CHAT_GROUP,
        name: groupDetails.title,
      }

      console.log(groupDetails.photo)
      if (groupDetails.photo && groupDetails.photo.minithumbnail && groupDetails.photo.minithumbnail.data) {
        const smallPhoto = await api.downloadFile(groupDetails.photo.small.id)
        item.icon = `data:image/jpeg;base64,` + smallPhoto
      }

      results[item._id] = item
    }

    return results
  }

}

// type._i = chatTypeSupergroup
      // title = name
      // photo.minithumbnail.data = image/icon
      // photo.minithumbnail.has_animation