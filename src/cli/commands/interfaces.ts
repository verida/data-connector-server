
export interface ConnectProviderOptions {
    provider: string
    key?: string
    network?: string
}

export interface SyncOptions {
    provider: string
    key?: string
    providerId?: string
    network?: string
    force?: boolean
}

export interface ResetProviderOptions {
    provider: string
    providerId?: string
    key?: string
    network?: string
    clearConnection?: boolean
    clearTokens?: boolean
    deleteData?: boolean
}

export interface DataOptions {
    schemaUri: string
    key?: string
    attributes: string
    sortField: string
    network?: string
}

export interface ConnectionsOptions {
    provider: string
    providerId?: string
    key?: string
    network?: string
    showConnections?: boolean
}