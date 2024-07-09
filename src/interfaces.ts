import { IContext } from "@verida/types"

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
    syncPosition: SyncPosition
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
    id?: string
    pos?: string
    next?: string
}