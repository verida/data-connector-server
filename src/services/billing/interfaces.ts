export enum BillingTxnType {
    VOUCHER = "voucher",
    CRYPTO = "crypto",
    FIAT = "fiat"
}

export enum BillingCryptoNetwork {
    POLPOS = "polpos"
}

export interface BillingDeposit {
    did: string
    credits: number
    description: string
    txnType: BillingTxnType
    txnId?: string
    cryptoType?: BillingCryptoNetwork
    insertedAt: string
}