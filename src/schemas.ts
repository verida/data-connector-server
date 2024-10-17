import { CalendarAttachment, DateTimeInfo, Person } from "./providers/google/interfaces"

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
    indexableText?: string
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
    toName: string
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

export interface SchemaSocialChatGroup extends SchemaRecord {
    newestId?: string
    syncData?: string
}

export enum SchemaChatMessageType {
    SEND = "send",
    RECEIVE = "receive"
}

export interface SchemaSocialChatMessage extends SchemaRecord {
    groupId: string
    groupName?: string
    type: SchemaChatMessageType
    messageText: string
    messageHTML?: string
    fromId: string
    fromHandle?: string
    fromName?: string
    sentAt: string
}

export enum DocumentType {
    TXT = "txt",
    PDF = "pdf",
    DOC = "doc",
    DOCX = "docx",
    XLS = "xls",
    XLSX = "xlsx",
    PPT = "ppt",
    PPTX = "pptx",
    OTHER = "other"
}

export interface SchemaFile extends SchemaRecord {
    extension: string
    mimeType: string
    size: number
    contentText?: string
    fileDataId?: string
    uri?: string

}

export interface SchemaCalendar extends SchemaRecord {
    description?: string
    timezone?: string
    location?: string
    syncData?: string
}

export interface SchemaEvent extends SchemaRecord {
    status?: string
    description?: string
    calendarId: string
    location?: string
    creator?: Person
    organizer?: Person
    start: DateTimeInfo
    end: DateTimeInfo
    attendees?: Person[]
    conferenceData?: object
    attachments?: CalendarAttachment[]

}
