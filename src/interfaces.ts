import { Request } from "express";
import { SchemaRecord } from "./schemas"

export interface UniqueRequest extends Request {
    requestId?: string;
}

export interface AccountAuth {
    accessToken: string,
    refreshToken: string
}

export interface ConnectionOption {
    name: string
    label: string
    type: 'enum' | 'boolean'
    enumOptions?: string[]
    defaultValue: string
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
    CONNECTED = "connected",    // sync is connected, but not currently running
    ERROR = "error",            // sync had an error on its last run
    PAUSED = "paused",          // sync is temporarily paused
    SYNC_REQUESTED = "sync-requested",  // sync has been requested, but not yet started (deprecated?)
    SYNC_ACTIVE = "sync-active",        // sync is currently running
    DISABLED = "disabled"               // sync is permanently disabled
}

export interface ConnectionHandler {
    name: string
    enabled: boolean
    config: Record<string, string>
}

export interface Connection {
    _id?: string
    _rev?: string
    name: string
    provider: string
    providerId: string
    accessToken: string
    refreshToken?: string
    profile: ConnectionProfile
    syncStatus: SyncStatus
    syncFrequency: SyncFrequency
    syncStart?: string
    syncEnd?: string
    syncNext?: string
    handlers: ConnectionHandler[]
    config: Record<string, string>
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

export interface SyncHandlerPosition {
    // id = `${providerName}:${handlerName]}:${status}`
    _id: string
    _rev?: string
    type: SyncSchemaPositionType
    providerName: string
    providerId: string
    handlerName: string
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
    position: SyncHandlerPosition
}

export interface SyncProviderLogEntry {
    _id?: string
    insertedAt?: string
    providerName: string
    providerId?: string
    handlerName?: string
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
    syncPosition: SyncHandlerPosition
    syncResults: SchemaRecord[]
    backfillPosition: SyncHandlerPosition
    backfillResults: SchemaRecord[]
}