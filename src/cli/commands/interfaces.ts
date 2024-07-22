
export interface ConnectProviderOptions {
    provider: string
    key: string
    network?: string
}

export interface SyncOptions {
    provider: string
    key: string
    network?: string
    force?: boolean
}

export interface ResetProviderOptions {
    provider: string
    key: string
    network?: string
    clearTokens?: boolean
    deleteData?: boolean
}

export interface DataOptions {
    schemaUri: string
    key: string
    attributes: string
    sortField: string
    network?: string
}