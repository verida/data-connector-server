import { BillingAccountType } from "../../../../services/billing/interfaces"

export interface AuthRequest {
    appDID?: string
    userDID: string
    scopes: string[]
    payer?: BillingAccountType
    timestamp: number
}

export interface AuthToken {
    _id: string
    scopes: string[]
    servers: string[]
    appDID?: string
}

export interface APIKeyData {
    session: string,
    scopes: string[]
    payer: BillingAccountType
    userDID: string
    appDID?: string
}

export enum ScopeType {
    DATASTORE = "ds",
    DATABASE = "db",
    API = "api",
}

export interface Scope {
    type: ScopeType
    description: string
    userNote?: string
    credits?: number
}