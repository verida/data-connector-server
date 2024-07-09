export interface SchemaRecord {
    _id: string
    name: string
    insertedAt: string
    icon?: string
    uri?: string
    sourceApplication?: string
    sourceId?: string
    sourceData?: object
}

export interface SchemaFollowing extends SchemaRecord {
    followedTimestamp?: string
}