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

export interface SyncSchemaPosition {
    // id = `${provider}/${schemaUri]}`
    _id: string
    provider: string
    schemaUri: string
    status: SyncStatus

    // Reference point for the current sync
    thisRef?: string

    // Reference point type for this reference for the current sync
    thisRefType?: string

    // Record ID to break on, if hit
    breakId?: string

    // Future record ID to break on, for the next sync
    futureBreakId?: string
}

export interface SyncResponse {
    results: object[]
    position: SyncSchemaPosition
}