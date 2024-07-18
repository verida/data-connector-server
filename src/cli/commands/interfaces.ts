
export interface ConnectProviderOptions {
    provider: string
    key: string
    network?: string
}

export interface SyncOptions {
    provider: string
    key: string
    network?: string
}

export interface ResetProviderOptions {
    provider: string
    key: string
    network?: string
    clearTokens?: boolean
}

export interface DataOptions {
    schemaUri: string
    key: string
    network?: string
}