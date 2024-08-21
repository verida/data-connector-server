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
  SchemaChatMessageType,
  SchemaSocialChatGroup,
  SchemaSocialChatMessage,
} from "../../schemas";
import { TelegramApi } from "./api";
import { TelegramChatGroupType, TelegramConfig } from "./interfaces";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { ItemsRange } from "../../helpers/interfaces";
import { UsersCache } from "./usersCache";

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

  protected async buildChatGroupList(
    api: TelegramApi,
    syncPosition: SyncHandlerPosition): Promise<SchemaSocialChatGroup[]> {
    let chatGroupIds: string[] = []
    if (syncPosition.thisRef) {
      // Load chat group list from current sync position
      chatGroupIds = syncPosition.thisRef.split(',')
    }

    // Fetch all the latest chat groups, fetches 500 by default
    const latestChatGroupIds = await api.getChatGroupIds()

    // Append the chat group list with any new chat groups so we don't miss any
    for (const groupId of latestChatGroupIds) {
      if (chatGroupIds.indexOf(groupId) === -1) {
        chatGroupIds.push(groupId)
      }
    }

    // Build chat group data for each group ID
    const chatGroupResults = await this.buildChatGroupResults(api, chatGroupIds, this.config.groupLimit)

    // Build a list of chat groups to process that includes the newest / oldest
    // IDs from the database, if they exist
    // let chatGroupsBacklog: SchemaSocialChatGroup[] = []
    if (this.config.useDbPos) {
      const chatGroupDs = await this.provider.getDatastore(CONFIG.verida.schemas.CHAT_GROUP)
      const chatGroupDbItems = <SchemaSocialChatGroup[]> await chatGroupDs.getMany({
        "sourceId": {
          "$in": chatGroupIds
        }
      }, {
        limit: chatGroupIds.length
      })
      for (const chatItem of chatGroupDbItems) {
        if (chatGroupResults[chatItem._id]) {
          chatGroupResults[chatItem._id].newestId = chatItem.newestId
          chatGroupResults[chatItem._id].syncData = chatItem.syncData
        } else {
          chatGroupResults[chatItem._id] = chatItem
        }
      }
    }

    return Object.values(chatGroupResults)
  }

  /**
   * The anchor items in a range (startId, endId) may have been deleted, so we
   * need to detet that and lookup in the database new anchor items
   * 
   * @param api 
   * @param range 
   */
  protected async validateRange(api: TelegramApi, range: ItemsRange, chatGroupId: string, chatSourceId: string): Promise<ItemsRange> {
    const validatedRange: ItemsRange = {
      startId: range.startId,
      endId: range. endId
    }

    const handler = this
    async function getNextMessageId(chatGroupId: string, messageId: string, direction: string): Promise<string | undefined> {
      // Find the previous message
      const chatMessageDs = await handler.provider.getDatastore(CONFIG.verida.schemas.CHAT_MESSAGE)

      const query: any = {
        "sourceApplication": handler.getProviderApplicationUrl(),
        "chatGroupId": chatGroupId,
        "_id": {}
      }
      query._id[`$${direction == "desc" ? "lt" : "gt"}`] = handler.buildItemId(messageId)

      const messageResult = <SchemaSocialChatMessage[]> await chatMessageDs.getMany(query, {
        limit: 1,
        sort: [
          { _id: direction }
        ]
      })

      if (!messageResult.length) {
        return
      }

      return messageResult[0].sourceId
    }

    let messageDeleted = false

    if (range.startId) {
      try {
        await api.getChatMessage(chatSourceId, range.startId)
      } catch (err: any) {
        messageDeleted = true
        // Message not found, so fetch next from database
        validatedRange.startId = await getNextMessageId(chatGroupId, range.startId, "asc")
      }
    }

    if (range.endId) {
      try {
        await api.getChatMessage(chatSourceId, range.endId)
      } catch (err: any) {
        messageDeleted = true
        // Message not found, so fetch next from database
        validatedRange.endId = await getNextMessageId(chatGroupId, range.endId, "desc")
      }
    }

    if (messageDeleted) {
      // If a messsage was deleted, we need to verify the new range
      // as there may have been more than one message deleted
      return this.validateRange(api, validatedRange, chatGroupId, chatSourceId)
    }

    return validatedRange
  }

  protected async fetchMessageRange(currentRange: ItemsRange, chatGroup: SchemaSocialChatGroup, chatHistory: SchemaSocialChatMessage[], api: TelegramApi, userCache: UsersCache, totalMessageCount: number, groupMessageCount: number): Promise<{
    messagesAdded: number,
    breakIdHit: boolean
  }> {
    let messagesAdded = 0
    const startId = currentRange.startId ? parseInt(currentRange.startId) : undefined
    const endId = currentRange.endId? parseInt(currentRange.endId) : undefined

    // Set a maximum message limit that restricts on total message and the max group message count
    const messageLimit = Math.min(this.config.messageBatchSize - totalMessageCount, this.config.messagesPerGroupLimit - groupMessageCount)
    const { messages: recentGroupMessageList, breakIdHit } = await api.getChatHistory(parseInt(chatGroup.sourceId!), messageLimit, startId, endId)
    for (const messageData of recentGroupMessageList) {
      // Respect message limit
      // @todo use messageMaxAgeDays
      if (messagesAdded >= messageLimit) {
        // console.log(' -fetchMessageRange hit messageLimit ', messageLimit)
        break
      }

      // console.log(`chatGroupId for message: ${chatGroup._id} / ${chatGroup.sourceId}`)
      const message = await this.buildMessage(messageData, chatGroup, userCache)

      if (message) {
        chatHistory.push(message)
        messagesAdded++
      }
    }

    // console.log('fetchMessageRange added messages ', messagesAdded)

    return {
      messagesAdded,
      breakIdHit
    }
  }

  protected async processChatGroup(chatGroup: SchemaSocialChatGroup, api: TelegramApi, userCache: UsersCache, totalMessageCount: number): Promise<{
    chatGroup: SchemaSocialChatGroup,
    chatHistory: SchemaSocialChatMessage[]
  }> {
    console.log(`- Processing group: ${chatGroup.name} (${chatGroup.sourceId}) - ${chatGroup.syncData}`)
    const chatHistory: SchemaSocialChatMessage[] = []
    const rangeTracker = new ItemsRangeTracker(chatGroup.syncData)
    let groupMessageCount = 0

    let newItems = true
    while (true) {
      // console.log(`- ${chatGroup.name}: Processing next batch`)
      // We have more messages to fetch
      // Fetch messages from the last fetched, up until the message limit
      const fetchedRange = rangeTracker.nextRange()

      const currentRange = await this.validateRange(api, fetchedRange, chatGroup._id, chatGroup.sourceId!)

      rangeTracker.updateRange(currentRange)

      const messagesResponse = await this.fetchMessageRange(currentRange, chatGroup, chatHistory, api, userCache, totalMessageCount, groupMessageCount)
      groupMessageCount += messagesResponse.messagesAdded
      totalMessageCount = messagesResponse.messagesAdded

      if (chatHistory.length) {
        rangeTracker.completedRange({
          startId: chatHistory[0].sourceId,
          endId: chatHistory[chatHistory.length-1].sourceId
        }, messagesResponse.breakIdHit)
      } else {
        rangeTracker.completedRange({
          startId: undefined,
          endId: undefined
        }, messagesResponse.breakIdHit)
      }

      // console.log(`- ${chatGroup.name}: Completed next batch of ${messagesResponse.messagesAdded}`, chatHistory.length)

      if (!newItems && messagesResponse.messagesAdded == 0) {
        // No more messages to fetch, so exit
        // console.log(`- ${chatGroup.name}: No more messages to fetch, so stop processing this group`)
        break
      }

      if (groupMessageCount >= this.config.messagesPerGroupLimit) {
        break
      }

      if (totalMessageCount >= this.config.messageBatchSize) {
        break
      }

      newItems = false
    }

    if (chatHistory.length) {
      chatGroup.newestId = chatHistory[0]._id
      chatGroup.syncData = rangeTracker.export()
    }

    // console.log(`- ${chatGroup.name}: Updated sync data: ${chatGroup.newestId}, ${chatGroup.syncData}`)

    return {
      chatGroup,
      chatHistory
    }
  }

  public async _sync(
    api: TelegramApi,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    // const chatGroupDs = await this.provider.getDatastore(CONFIG.verida.schemas.CHAT_GROUP)
    // const db2 = await chatGroupDs.getDb()
    // await db2.destroy({})

    // const chatMessageDs = await this.provider.getDatastore(CONFIG.verida.schemas.CHAT_MESSAGE)
    // const db = await chatMessageDs.getDb()
    // await db.destroy({})
    // throw new Error('destroyed')
   
    try {
      let groupCount = 0
      let messageCount = 0
      const userCache = new UsersCache(api)
      const chatGroups: SchemaSocialChatGroup[] = []
      const chatGroupsBacklog = await this.buildChatGroupList(api, syncPosition)
      console.log(`- Fetched ${chatGroupsBacklog.length} chat groups as backlog`)
      let chatHistory: SchemaSocialChatMessage[] = []

      // Process each chat group
      let groupLimitHit = false
      for (const chatGroup of chatGroupsBacklog) {
        // Respect group limit
        if (groupCount++ >= this.config.groupLimit) {
          console.log(`- Group limit hit`)
          groupLimitHit = true
          break
        }

        const chatGroupResponse = await this.processChatGroup(chatGroup, api, userCache, messageCount)

        // Include this chat group in the list of processed groups to save
        chatGroups.push(chatGroupResponse.chatGroup)

        // Include the chat history
        chatHistory = chatHistory.concat(chatGroupResponse.chatHistory)
      }

      // Update sync position to have a list of the next set of groups to process
      const chatGroupIds = chatGroups.map(group => parseInt(group.sourceId!))
      const nextBatchGroupIds = chatGroupIds.splice(0, groupCount)
      syncPosition.thisRef = nextBatchGroupIds.join(',')

      if (!groupLimitHit && messageCount != this.config.messageBatchSize) {
        // No limits hit for this batch, so we simply ran out of messages and we can stop the sync
        syncPosition.status = SyncHandlerStatus.ENABLED
      }

      return {
        results: Object.values(chatGroups).concat(chatHistory),
        position: syncPosition
      }
    } catch (err: any) {
        console.log(err)
        throw err
    }
  }

  protected async buildMessage(rawMessage: any, chatGroup: SchemaSocialChatGroup, userCache: UsersCache): Promise<SchemaSocialChatMessage | undefined> {
    const groupId = chatGroup._id
    const timestamp = (new Date(rawMessage.date * 1000)).toISOString()

    let content = ""
    if (rawMessage.content['text']) {
      content = rawMessage.content.text.text
    } else if (rawMessage.content['caption']) {
      content = rawMessage.content.caption.text
    }

    if (content == "") {
      console.log('empty content')
      console.log(rawMessage.content)
      return
    }

    const user = await userCache.getUser(rawMessage.sender_id.user_id)
    const fromName = user.fullName
    const fromHandle = user.username

    const message: SchemaSocialChatMessage = {
      _id: this.buildItemId(rawMessage.id),
      name: content.substring(0,30),
      groupId,
      groupName: chatGroup.name,
      type: rawMessage.is_outgoing ? SchemaChatMessageType.SEND : SchemaChatMessageType.RECEIVE,
      fromId: rawMessage.sender_id.user_id.toString(),
      fromHandle,
      fromName,
      messageText: content,
      sourceApplication: this.getProviderApplicationUrl(),
      sourceId: rawMessage.id.toString(),
      sourceData: rawMessage,
      insertedAt: timestamp,
      sentAt: timestamp
    }

    return message
  }

  protected async buildChatGroupResults(api: TelegramApi, chatGroupIds: string[], limit: number): Promise<Record<string, SchemaSocialChatGroup>> {
    const results: Record<string, SchemaSocialChatGroup> = {}
    const now = (new Date()).toISOString()

    let groupCount = 0
    for (const groupId of chatGroupIds) {
      if (groupCount >= limit) {
        break
      }

      const groupDetails = await api.getChatGroup(parseInt(groupId))
      console.log(groupDetails.title, groupDetails.type._)
      if (groupDetails.type._ == TelegramChatGroupType.SUPERGROUP) {
        const supergroupDetails = await api.getSupergroup(groupDetails.type.supergroup_id)
        if (supergroupDetails.member_count > this.config.maxGroupSize) {
          console.log('group too big')
          continue
        }
      }

      const item: SchemaSocialChatGroup = {
        _id: this.buildItemId(groupId.toString()),
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: groupId.toString(),
        sourceData: groupDetails,
        schema: CONFIG.verida.schemas.CHAT_GROUP,
        name: groupDetails.title,
        insertedAt: now
      }

      if (groupDetails.photo && groupDetails.photo.minithumbnail && groupDetails.photo.minithumbnail.data) {
        const smallPhoto = await api.downloadFile(groupDetails.photo.small.id)
        item.icon = `data:image/jpeg;base64,` + smallPhoto
      }

      groupCount++
      results[item._id] = item
    }

    return results
  }
}