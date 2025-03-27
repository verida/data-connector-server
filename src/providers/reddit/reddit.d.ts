import { BaseHandlerConfig } from "../../interfaces"

export enum RedditChatType {
    INBOX = "chatTypeInbox",
    UNREAD = "chatTypeUnread",
    SENT = "chatTypeSent",
}

export interface RedditConfig extends BaseHandlerConfig {
    apiId: number
    apiHash: string
    maxSyncLoops: number
    // What is the maximum number of days to backdate
    messageMaxAgeDays: number,
    // Maximum number of messages to process in a given batch
    messageBatchSize: number
    useDbPos: boolean
}
