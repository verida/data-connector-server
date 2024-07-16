export interface AccountAuth {
    accessToken: string,
    refreshToken: string
}

export interface AccountProfile {
    id: string,
    name?: string
    username?: string
    description?: string
    createdAt?: string
    url?: string
    avatarUrl?: string
    credential?: string
}

export interface Connection {
    accessToken: string
    refreshToken: string
    profile: AccountProfile
    syncPositions: Record<string, SyncSchemaPosition>
}

export interface DatastoreSaveResponse {
    id: string
}

export enum SyncStatus {
    STOPPED,
    ACTIVE
}

export enum SyncHandlerMode {
    SNAPSHOT,
    UPDATE
}

export interface SyncSchemaPosition {
    // id = `${provider}/${schemaUri]}`
    _id: string
    provider: string
    schemaUri: string
    mode: SyncHandlerMode
    status: SyncStatus
    // ID of the record to stop at
    id?: string
    // Position to stop at (ie: A unique page number)
    pos?: string
    // Next result set (ie: URL of results page)
    next?: string
}

export interface SyncResponse {
    results: object[]
    position: SyncSchemaPosition
}