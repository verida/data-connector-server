export interface SchemaRecord {
    _id: string
    _rev?: string
    schema?: string
    name: string
    summary?: string
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
    description?: string
    followedTimestamp?: string
    insertedAt: string
}

export enum SchemaPostType {
    LINK = "link",
    STATUS = "status",
    PHOTO = "photo",
    VIDEO = "video",
    MUSIC = "music",
    EVENT = "event",
    OFFER = "offer",
    QUESTION = "question",
    NOTE = "note",
    ALBUM = "album",
    LIFE_EVENT = "life_event"
}

export interface SchemaPost extends SchemaRecord {
    type?: SchemaPostType
    content?: string
    contentHtml? :string
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

export enum SchemaFavouriteType {
    LIKE = "like",
    FAVOURITE = "favourite",
    RECOMMENDATION = "recommendation",
    SHARE = "share"
}

export enum SchemaFavouriteContentType {
    VIDEO = "video",
    AUDIO = "audio",
    DOCUMENT = "document",
    WEBPAGE = "webpage"
}

export interface SchemaFavourite extends SchemaRecord {
    favouriteType?: SchemaFavouriteType
    contentType?: SchemaFavouriteContentType
    description?: string
}