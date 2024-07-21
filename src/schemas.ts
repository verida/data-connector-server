export interface SchemaRecord {
    _id: string
    _rev?: string
    name: string
    insertedAt?: string
    modifiedAt?: string
    icon?: string
    uri?: string
    sourceApplication?: string
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
    attachments?: SchemaEmailAttachment[]
    sentAt: string
    threadId?: string
}