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
}

export interface SchemaPost extends SchemaRecord {
    type?: string
    content?: string
    contentHtml? :string
    summary?: string
}