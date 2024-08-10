export interface SchemaRecord {
    _id: string
    _rev?: string
    schema?: string
    name: string
    description?: string
    insertedAt?: string
    modifiedAt?: string
    icon?: string
    uri?: string
    sourceApplication?: string
    sourceAccountId?: string
    sourceId?: string
    sourceData?: object
}

export interface SchemaFollowing extends SchemaRecord {
    followedTimestamp?: string
    insertedAt: string
}

export interface SchemaPost extends SchemaRecord {
    type?: string
    content?: string
    contentHtml? :string
    summary?: string
    insertedAt: string
}

export interface SchemaEmailAttachment {
    filename: string
    id: string
    data?: string
    textContent?: string
    uri?: string
}

export enum SchemaEmailType {
    SEND = "send",
    RECEIVE = "receive"
}

export interface SchemaEmail extends SchemaRecord {
    type: SchemaEmailType
    fromName: string
    fromEmail: string
    toEmail: string
    messageText: string
    messageHTML: string
    sentAt: string
    attachments?: SchemaEmailAttachment[]
    threadId?: string
}

export enum SchemaYoutubeActivityType {
    UPLOAD = "upload", // post
    LIKE = "like", // favourite
    SUBSCRIPTION = "subscription", // following
    FAVOURITE = "favourite", // favourite
    COMMENT = "comment", // post
    PLAYLIST_ITEM = "playlistItem", //ignored
    RECOMMENDATION = "recommendation", // favourite
}

export enum FavouriteType {
    LIKE = "like",
    FAVOURITE = "favourite",
    RECOMMENDATION = "recommendation",
    SHARE = "share"
}

export enum ContentType {
    VIDEO = "video",
    AUDIO = "audio",
    DOCUMENT = "document",
    WEBPAGE = "webpage"
}

export interface SchemaFavourite extends SchemaRecord {
    favouriteType: FavouriteType
    contentType: ContentType
}

export interface SchemaSocialChatGroup extends SchemaRecord {}

export interface SchemaSocialChatMessage extends SchemaRecord {
    chatGroupId: string
    type: "send" | "receive"
    messageText: string
    messageHTML?: string
    senderId: string
    senderHandle?: string
    sentAt: string
}