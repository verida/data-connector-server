
export enum BillingAccountType {
    APP = "app",
    USER = "user"
}

export interface BillingAccount {
    did: string
    tokens: BillingTokens
    insertedAt?: string
}

export enum BillingTxnType {
    FREE = "free",
    CRYPTO = "crypto",
    FIAT = "fiat"
}

export enum BillingCryptoNetwork {
    POLPOS = "polpos"
}

export interface BillingTokens {
    free: string
    owned: string
}

export interface BillingDeposit {
    did: string
    tokens: string
    description: string
    txnType: BillingTxnType
    txnId?: string
    cryptoType?: BillingCryptoNetwork
    insertedAt?: string
}