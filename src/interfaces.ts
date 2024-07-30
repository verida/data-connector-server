import { SchemaRecord } from "./schemas"

export interface AccountAuth {
    accessToken: string,
    refreshToken: string
}

export interface ConnectionOption {
    name: string
    label: string
    type: 'enum' | 'boolean'
    enumOptions?: string[]
    defaultValue: string | boolean
}

export interface HandlerOption extends ConnectionOption {}

export interface ConnectionProfile {
    id: string
    name: string
    avatarUrl?: string
    link?: string
    givenName?: string
    familyName?: string
    email?: string
    emailVerified?: boolean
    username?: string
    description?: string
    createdAt?: string
}

export enum SyncFrequency {
    HOUR = "hour",
    DAY = "day",
    WEEK = "week"
}

export enum SyncStatus {
    ACTIVE = "active",
    ERROR = "error",
    PAUSED = "paused",
    SYNC_REQUESTED = "sync-requested",
    SYNC_ACTIVE = "sync-active",
    DISABLED = "disabled"
}

export interface Connection {
    _rev?: string
    accessToken: string
    refreshToken: string
    profile: ConnectionProfile
    source: string
    syncStatus: SyncStatus
    syncFrequency: SyncFrequency
}

export interface BaseProviderConfig {
    label: string
    sbtImage: string
    batchSize?: number
    maxSyncLoops?: number
    // Other metadata useful to configure for the handler
    metadata?: object
}

export interface DatastoreSaveResponse {
    id: string
}

export enum SyncHandlerStatus {
    STOPPED = "stopped",
    ACTIVE = "active"
}

export enum SyncSchemaPositionType {
    SYNC = "sync",
    BACKFILL = "backfill"
}

export interface SyncSchemaPosition {
    // id = `${provider}:${schemaUri]}:${status}`
    _id: string
    _rev?: string
    type: SyncSchemaPositionType
    provider: string
    schemaUri: string
    status: SyncHandlerStatus

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

export interface SyncProviderLogEntry {
    _id?: string
    insertedAt?: string
    provider: string
    schemaUri?: string
    message: string
    level: SyncProviderLogLevel
}

export enum SyncProviderLogLevel {
    INFO = "info",
    DEBUG = "debug",
    ERROR = "error"
}

export interface SyncProviderErrorEvent {
    level: SyncProviderLogLevel
    message: string
}

export interface SyncHandlerResponse {
    syncPosition: SyncSchemaPosition
    syncResults: SchemaRecord[]
    backfillPosition: SyncSchemaPosition
    backfillResults: SchemaRecord[]
}