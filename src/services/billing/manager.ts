import { Collection, MongoClient, ObjectId } from "mongodb"
import CONFIG from "../../config"
import { UsageRequest } from "../usage/interfaces"
import { BillingDeposit, BillingTxnType } from "./interfaces"

const DSN = CONFIG.verida.centralDb.dsn
const DB_NAME = CONFIG.verida.centralDb.dbName
const ACCOUNTS_COLLECTION = CONFIG.verida.centralDb.accountsCollection
const DEPOSIT_COLLECTION = CONFIG.verida.centralDb.depositsCollection

const APP_DID_FREE_CREDITS = CONFIG.verida.billing.appFreeCredits
const USER_DID_FREE_CREDITS = CONFIG.verida.billing.userFreeCredits
const USER_CREDITS_PER_REQUEST = CONFIG.verida.billing.userCreditsPerRequest

export enum AccountType {
    APP = "app",
    USER = "user"
}

export function nowTimestamp() {
    return new Date().toISOString()
}

class BillingManager {

    private client?: MongoClient

    public async registerAccount(did: string, type: AccountType) {
        if (!await this.init()) {
            return
        }

        did = this.normalizeDID(did)

        let credits = 0
        if (type == AccountType.APP) {
            credits = APP_DID_FREE_CREDITS
        } else {
            credits = USER_DID_FREE_CREDITS
        }

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        try {
            await collection.insertOne({
                did,
                credits,
                insertedAt: nowTimestamp()
            })

            await this.deposit({
                did,
                credits,
                description: "Welcome credit",
                txnType: BillingTxnType.VOUCHER
            })
        } catch (err) {
            if (err.message.match('duplicate key error')) {
                // Already exists
                return
            }

            throw new Error(`Unable to register account`)
        }
    }

    public async ensureAccountExists(did: string) {
        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        try {
            await collection.insertOne({
                did,
                credits: 0,
                insertedAt: nowTimestamp()
            })
        } catch (err) {
            if (err.message.match('duplicate key error')) {
                // Already exists
                return
            }

            throw new Error(`Unable to create account`)
        }
    }

    public async deposit(depositInfo: Omit<BillingDeposit, "insertedAt">) {
        const collection = await this.getCollection(DEPOSIT_COLLECTION)

        try {
            await collection.insertOne({
                ...depositInfo,
                insertedAt: nowTimestamp()
            })
        } catch (err) {
            throw new Error(`Unable to save deposit`)
        }
    }

    public async getBalance(did: string): Promise<any> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        did = this.normalizeDID(did)

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        const result = await collection.findOne({
            did
        })

        if (!result) {
            return 0
        }

        return result.credits
    }

    public async getDeposits(did: string): Promise<any> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        did = this.normalizeDID(did)

        const collection = await this.getCollection(DEPOSIT_COLLECTION)
        return await collection.find({
            appDID: did
        }).toArray()
    }

    public async handleRequest(request: UsageRequest) {
        if (request.appDID) {
            await this.ensureAccountExists(request.appDID)
        }

        if (request.userDID) {
            await this.ensureAccountExists(request.userDID)
        }

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        if (request.appDID && request.credits) {
            await collection.updateOne({
                did: this.normalizeDID(request.appDID)
            }, {
                "$inc": {
                    credits: (0 - request.credits)
                }
            })

            await collection.updateOne({
                did: this.normalizeDID(request.userDID)
            }, {
                "$inc": {
                    credits: USER_CREDITS_PER_REQUEST
                }
            })
        } else if (request.appDID && request.credits) {
            await collection.updateOne({
                did: this.normalizeDID(request.userDID)
            }, {
                "$inc": {
                    credits: (0 - request.credits)
                }
            })
        }
    }

    private async getCollection(collectionName: string): Promise<Collection> {
        try {
            // Select the database
            const db = this.client.db(DB_NAME);
    
            // Load collection
            const collection = db.collection(collectionName);

            return collection        
          } catch (err) {
            console.error("Error connecting to MongoDB", err);
            throw new Error(`Unable to connect to usage database`)
          }
    }

    public async buildIndexes() {
        try {
            if (!await this.init()) {
                return
            }

            const accountsCollection = await this.getCollection(ACCOUNTS_COLLECTION)
            await accountsCollection.createIndex({
                did: 1
            }, {
                unique: true
            })
        } catch (err) {
            console.log(err)
        }
    }

    private async init(): Promise<boolean> {
        if (this.client) {
            return true
        }

        if (!DSN) {
            return false
        }

        try {
            // Connect to MongoDB
            this.client = new MongoClient(DSN)
            await this.client.connect();
        } catch (err) {
            console.error("Error connecting to MongoDB", err);
            throw new Error(`Unable to connect to usage database`)
        }

        return true
    }

    private normalizeDID(did: string) {
        return did.replace('mainnet', 'polpos')
    }
}

const manager = new BillingManager()
export default manager