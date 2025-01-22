import { Collection, MongoClient, ObjectId } from "mongodb"
import CONFIG from "../../config"

const DSN = CONFIG.verida.centralDb.dsn
const DB_NAME = CONFIG.verida.centralDb.dbName
const ACCOUNTS_COLLECTION = CONFIG.verida.centralDb.accountsCollection
const APP_DID_FREE_CREDITS = CONFIG.verida.billing.appFreeCredits
const USER_DID_FREE_CREDITS = CONFIG.verida.billing.userFreeCredits

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

        let credits = 0
        if (type == AccountType.APP) {
            credits = APP_DID_FREE_CREDITS
        } else {
            credits = USER_DID_FREE_CREDITS
        }

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        try {
            await collection.insertOne({
                _id: new ObjectId(did),
                credits,
                insertedAt: nowTimestamp()
            })
        } catch (err) {
            if (err.message.match('duplicate key error')) {
                // Already exists
                return
            }

            throw new Error(`Unable to link user and DID`)
        }
    }

    public async getBalance(did: string): Promise<any> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        const results = await collection.findOne({
            _id: new ObjectId(did)
        })

        if (!results) {
            return 0
        }

        return results[0].credits
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
}

const manager = new BillingManager()
export default manager