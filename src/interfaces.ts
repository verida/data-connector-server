
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

export interface SyncSchemaConfig {
    limit?: number
    sinceId?: string
}

export interface Connection {
    accessToken: string
    refreshToken: string
    profile: AccountProfile
}

export interface DatastoreSaveResponse {
    id: string
}