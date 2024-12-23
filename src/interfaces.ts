import { Request } from "express";
import { Profile as PassportBaseProfile } from "passport"
import { SchemaRecord } from "./schemas"

export interface UniqueRequest extends Request {
    requestId: string;
}

export interface AccountAuth {
    accessToken: string,
    refreshToken: string
}

export enum ConnectionOptionType {
    ENUM = "enum",
    ENUM_MULTI = "enumMulti",
    BOOLEAN = "boolean"
}

export interface ConnectionOptionEnumOption {
    value: string
    label: string
}

export interface ConnectionOption {
    id: string
    label: string
    type: ConnectionOptionType
    enumOptions?: ConnectionOptionEnumOption[]
    defaultValue: string
}

export interface BaseHandlerConfig extends Record<string, string | boolean | number> {
    batchSize?: number
    breakTimestamp?: string
    backdate?: string
}

export interface PassportProfile extends PassportBaseProfile {
    connectionProfile?: Partial<ConnectionProfile>
}

export interface ProviderHandler {
    id: string
    label: string
    options: ProviderHandlerOption[]
}

export interface ProviderHandlerOption extends ConnectionOption {}

export interface AvatarObject extends Object {
    uri: string
}

export interface ConnectionProfile {
    id: string
    name: string
    description?: string
    avatar?: AvatarObject
    link?: string
    givenName?: string
    familyName?: string
    email?: string
    emailVerified?: boolean
    phone?: string
    phoneVerified?: boolean
    verified?: boolean
    username?: string
    readableId: string
    createdAt?: string
    sourceData?: object
}

export interface ConnectionCallbackResponse {
    id: string
    accessToken: string
    refreshToken?: string
    profile: PassportProfile
}

export enum SyncFrequency {
    HOUR = "hour",
    HOUR_3 = "3hour",
    HOUR_6 = "6hour",
    HOUR_12 = "12hour",
    DAY = "day",
    DAY_3 = "3day",
    WEEK = "week"
}

export enum SyncStatus {
    CONNECTED = "connected",    // sync is connected, but not currently running
    ERROR = "error",            // sync had an error on its last run
    PAUSED = "paused",          // sync is temporarily paused
    ACTIVE = "active",        // sync is currently running
    INVALID_AUTH = "invalid-auth", // invalid auth token to the third party connector
}

export interface ConnectionHandler {
    id: string
    enabled: boolean
    config: BaseHandlerConfig
}

export interface Connection {
    _id?: string
    _rev?: string
    name: string
    providerId: string
    accountId: string
    accessToken: string
    refreshToken?: string
    profile: ConnectionProfile
    syncStatus: SyncStatus
    syncFrequency: SyncFrequency
    syncStart?: string | object
    syncEnd?: string
    syncNext?: string
    syncMessage?: string
    authExpired?: boolean
    handlers: ConnectionHandler[]
    config: Record<string, string>
}

export interface BaseProviderConfig {
    label: string
    // TODO: Make it required
    status?: 'active' | 'upcoming' | 'inactive'
    sbtImage: string
    batchSize?: number
    maxSyncLoops?: number
    breakTimestamp?: string
    // Custom config for each handler
    handlers?: Record<string, object>
}

export interface DatastoreSaveResponse {
    id: string
}

export enum SyncHandlerStatus {
    ENABLED = "enabled",
    ERROR = "error",
    DISABLED = "disabled",
    SYNCING = "syncing",
    INVALID_AUTH = "invalid-auth",  // permission denied for this handler
}

export interface SyncHandlerPosition {
    // id = `${providerName}:${handlerName]}:${status}`
    _id: string
    _rev?: string
    providerId: string
    accountId: string
    handlerId: string
    status: SyncHandlerStatus

    // Message describing the status of the sync
    syncMessage?: string

    // Reference point for the current sync
    thisRef?: string

    // Reference point type for this reference for the current sync
    thisRefType?: string

    // Record ID to break on, if hit
    breakId?: string

    // Future record ID to break on, for the next sync
    futureBreakId?: string

    // How many retries have had errors
    errorRetries?: number

    // Timestamp when latest sync started
    latestSyncStart?: string

    // Timestamp when latest sync ended
    latestSyncEnd?: string

    // Timestamp of the oldest saved record
    oldestDataTimestamp?: string

    // Timestamp of the newest saved record
    newestDataTimestamp?: string
}

export interface SyncResponse {
    results: object[]
    position: SyncHandlerPosition
}

export interface SyncProviderLogEntry {
    _id?: string
    insertedAt?: string | object
    providerId: string
    accountId?: string
    handlerId?: string
    schemaUri?: string
    message: string | object
    level: SyncProviderLogLevel
}

export enum SyncProviderLogLevel {
    INFO = "info",
    DEBUG = "debug",
    ERROR = "error",
    WARNING = "warning"
}

export interface SyncProviderLogEvent {
    level: SyncProviderLogLevel
    message: string
}

export interface SyncHandlerResponse {
    syncPosition: SyncHandlerPosition
    syncResults: SchemaRecord[]
}

export interface SyncItemsResult {
    items: SchemaRecord[]
    breakHit?: SyncItemsBreak
}

export enum SyncItemsBreak {
    ID = "id",
    TIMESTAMP = "timestamp"
}
