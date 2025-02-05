
export interface UsageRequestTokens {
    input: number
    output: number
    total: number
}

export interface UsageRequest {
    appDID?: string
    userDID: string
    resultSize: number
    path: string
    credits?: number
    tokens?: UsageRequestTokens
    latency: number
    insertedAt?: string
}

export interface UsageAccount {
    appDID: string
    userDID: string
    insertedAt: string
}

export interface UsageStats {
    connectedAccounts: number
    requests: number
    resultSize: number
}