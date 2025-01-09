
export interface AuthRequest {
    appDID: string
    userDID: string
    scopes: string[]
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
    userDID: string
    appDID?: string
}