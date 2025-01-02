import { VeridaOAuthUser } from "./user"
import { VeridaOAuthClient } from "./client"

export interface AuthRequestObject {
    appDID: string
    userDID: string
    scopes: string[]
    timestamp: number
}

export interface AuthRequest {
    appDID: string
    userDID: string
    scopes: string[]
    timestamp: string
}

// export interface OAuthToken {
//     accessToken: string
//     accessTokenExpiresAt: Date
//     refreshToken: string
//     refreshTokenExpiresAt: Date
//     scope: string[]
//     user: VeridaOAuthUser
//     client: VeridaOAuthClient
// }

export interface VeridaOAuthCode {
    authorizationCode: string,
    expiresAt: Date,
    redirectUri: string,
    scope: string[]
    client: VeridaOAuthClient
    user: VeridaOAuthUser
}

export interface AuthCodeRecord {
    _id: string
    expiresAt: string,
    redirectUri: string,
    scope: string[]
    userDID: string
    appDID: string
    insertedAt: string
}

export interface VeridaOAuthToken {
    accessToken: string,
    accessTokenExpiresAt: string
    refreshToken?: string
    refreshTokenExpiresAt: string
    scope: string[]
    client: VeridaOAuthClient
    user: VeridaOAuthUser
}

export interface OAuthToken {
    accessToken: string,
    authorizationCode: string,
    accessTokenExpiresAt: string,
    refreshToken: string,
    refreshTokenExpiresAt: string,
    scope: string[]
}