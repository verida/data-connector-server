import { BaseHandlerConfig } from "../../interfaces"

export enum TelegramChatGroupType {
    SUPERGROUP = "chatTypeSupergroup",
    SECRET = "chatTypeSecret",
    PRIVATE = "chatTypePrivate",
    BASIC = "chatTypeBasicGroup"
}

export interface TelegramConfig extends BaseHandlerConfig {
    apiId: number
    apiHash: string
    maxSyncLoops: number
    // Maximum number of groups to process
    groupLimit: number,
    // What is the maximum number of days to backdate
    messageMaxAgeDays: number,
    // Maximum number of messages to process in a given batch
    messageBatchSize: number
    // Maximum number of messages to process in a group
    messagesPerGroupLimit: number
    // Maximum number of members in a group for it to be processed
    maxGroupSize: number
    useDbPos: boolean
}