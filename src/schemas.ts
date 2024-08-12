export interface SchemaRecord {
    _id: string
    _rev?: string
    schema?: string
    name: string
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

export enum PostType {
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
    type?: PostType
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
    description?: string
}

export enum DocumentType {
    TXT = "txt",
    PDF = "pdf",
    DOC = "doc",
    DOCX = "docx",
    XLS = "xls",
    XLSX = "xlsx",
    PPT = "ppt",
    PPTX = "pptx"
}

export interface SchemaDocument extends SchemaRecord {
    type: DocumentType
    size: number
    contentText: string
    contentRaw?: string
}

export interface SchemaDocument extends SchemaRecord {
    type: DocumentType
    size: number
    contentText: string
    contentRaw?: string
}