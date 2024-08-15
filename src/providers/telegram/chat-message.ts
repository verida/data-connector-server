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
import { CompletedRangeTracker } from "../../helpers/completedRangeTracker";
import { CompletedItemsRange } from "../../helpers/interfaces";

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

    // Fetch all the latest chat groups
    // Note: Groups with large numbers of members will be excluded
    // so fetch 3x the number of limit groups so we get them all
    const chatGroupIdLimit = Math.max(this.config.groupLimit * 4, 20)
    const latestChatGroupIds = await api.getChatGroupIds(chatGroupIdLimit)

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
          chatGroupResults[chatItem._id].syncData = chatItem.syncData
        } else {
          chatGroupResults[chatItem._id] = chatItem
        }

        chatGroupsBacklog.push(chatGroupResults[chatItem._id])
      }
    } else {
      chatGroupsBacklog = Object.values(chatGroupResults)
    }

    return chatGroupsBacklog
  }

  protected async fetchMessageRange(currentRange: CompletedItemsRange, chatGroup: SchemaSocialChatGroup, chatHistory: SchemaSocialChatMessage[], api: TelegramApi, totalMessageCount: number, groupMessageCount: number): Promise<{
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
        console.log(' -fetchMessageRange hit messageLimit ', messageLimit)
        break
      }

      const message = this.buildMessage(messageData, chatGroup._id)
      chatHistory.push(message)
      messagesAdded++
    }

    console.log('fetchMessageRange added messages ', messagesAdded)

    return {
      messagesAdded,
      breakIdHit
    }
  }

  protected async processChatGroup(chatGroup: SchemaSocialChatGroup, api: TelegramApi, totalMessageCount: number): Promise<{
    chatHistory: SchemaSocialChatMessage[]
  }> {
    console.log(`- Processing group: ${chatGroup.name} (${chatGroup.sourceId})`)
    const chatHistory: SchemaSocialChatMessage[] = []
    const rangeTracker = new CompletedRangeTracker(chatGroup.syncData)
    let groupMessageCount = 0

    // Fetch messages from now up until the newest
    let currentRange = rangeTracker.newItemsRange()
    let messagesResponse = await this.fetchMessageRange(currentRange, chatGroup, chatHistory, api, totalMessageCount, groupMessageCount)
    groupMessageCount += messagesResponse.messagesAdded
    totalMessageCount = messagesResponse.messagesAdded

    if (chatHistory.length) {
      rangeTracker.completedRange({
        startId: chatHistory[0].sourceId!,
        endId: chatHistory[chatHistory.length-1].sourceId
      }, messagesResponse.breakIdHit)
    }

    console.log(`- ${chatGroup.name}: Completed new items range`, chatHistory.length)
    console.log(messagesResponse.breakIdHit, totalMessageCount, this.config.messageBatchSize, groupMessageCount)

    while (!messagesResponse.breakIdHit && totalMessageCount < this.config.messageBatchSize && groupMessageCount < this.config.messagesPerGroupLimit) {
      console.log(`- ${chatGroup.name}: Have more messages to fetch as limits not yet hit`)
      console.log(messagesResponse.breakIdHit, totalMessageCount, this.config.messageBatchSize, groupMessageCount)
      // We have more messages to fetch
      // Fetch messages from the last fetched, up until the message limit
      currentRange = rangeTracker.nextBackfillRange()

      messagesResponse = await this.fetchMessageRange(currentRange, chatGroup, chatHistory, api, totalMessageCount, groupMessageCount)
      groupMessageCount += messagesResponse.messagesAdded
      totalMessageCount = messagesResponse.messagesAdded

      rangeTracker.completedRange({
        startId: chatHistory[0].sourceId!,
        endId: chatHistory[chatHistory.length-1].sourceId
      }, messagesResponse.breakIdHit)

      console.log(`- ${chatGroup.name}: Completed next batch of ${messagesResponse.messagesAdded}`)

      if (messagesResponse.messagesAdded == 0) {
        // No more messages to fetch, so exit
        console.log(`- ${chatGroup.name}: No more messages to fetch, so stop processing this group`)
        break
      }
    }

    if (chatHistory.length) {
      chatGroup.newestId = chatHistory[0]._id
      chatGroup.syncData = rangeTracker.export()
    }

    console.log(`- ${chatGroup.name}: Updated sync data: ${chatGroup.newestId}, ${chatGroup.syncData}`)

    return {
      chatHistory
    }
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
      let groupCount = 0
      let messageCount = 0
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

        const chatGroupResponse = await this.processChatGroup(chatGroup, api, messageCount)

        // Include this chat group in the list of processed groups to save
        chatGroups.push(chatGroup)

        // Include the chat history
        chatHistory = chatHistory.concat(chatGroupResponse.chatHistory)
      }

      // Update sync position to have a list of the next set of groups to process
      const chatGroupIds = chatGroups.map(group => parseInt(group.sourceId!))
      const nextBatchGroupIds = chatGroupIds.splice(0, groupCount)
      syncPosition.thisRef = nextBatchGroupIds.join(',')

      if (!groupLimitHit && messageCount != this.config.messageBatchSize) {
        // No limits hit for this batch, so we simply ran out of messages and we can stop the sync
        syncPosition.status = SyncHandlerStatus.STOPPED
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

  protected buildMessage(rawMessage: any, chatGroupId: string): SchemaSocialChatMessage {
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
    }

    // @todo: better support all message types https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1_message_content.html
    // switch (rawMessage.content._) {
    //   case ""
    // }

    const message: SchemaSocialChatMessage = {
      _id: `${this.provider.getProviderName()}-${this.connection.profile.id}-${rawMessage.id}`,
      name: content.substring(0,30),
      chatGroupId,
      type: rawMessage.is_outgoing ? SchemaChatMessageType.SEND : SchemaChatMessageType.RECEIVE,
      senderId: rawMessage.sender_id.user_id.toString(),
      messageText: content,
      sourceId: rawMessage.id.toString(),
      insertedAt: timestamp,
      sentAt: timestamp
    }

    return message
  }

  protected async buildChatGroupResults(api: TelegramApi, chatGroupIds: string[]): Promise<Record<string, SchemaSocialChatGroup>> {
    const results: Record<string, SchemaSocialChatGroup> = {}
    const now = (new Date()).toISOString()

    for (const groupId of chatGroupIds) {
      const groupDetails = await api.getChatGroup(parseInt(groupId))
      if (groupDetails.type._ == TelegramChatGroupType.SUPERGROUP) {
        const supergroupDetails = await api.getSupergroup(groupDetails.type.supergroup_id)
        if (supergroupDetails.member_count > this.config.maxGroupSize) {
          continue
        }
      }


      // if (this.config.supportedChatGroupTypes.indexOf(groupDetails.type._) === -1) {
      //   console.log(`skipping group (${groupDetails.title}) as it is wrong type: ${groupDetails.type._}`)
      //   console.log(groupDetails)
      //   continue
      // }

      const item: SchemaSocialChatGroup = {
        _id: `${this.provider.getProviderName()}-${this.connection.profile.id}-${groupId.toString()}`,
        sourceId: groupId.toString(),
        schema: CONFIG.verida.schemas.CHAT_GROUP,
        name: groupDetails.title,
        insertedAt: now
      }

      if (groupDetails.photo && groupDetails.photo.minithumbnail && groupDetails.photo.minithumbnail.data) {
        const smallPhoto = await api.downloadFile(groupDetails.photo.small.id)
        item.icon = `data:image/jpeg;base64,` + smallPhoto
      }

      results[item._id] = item
    }

    return results
  }
}