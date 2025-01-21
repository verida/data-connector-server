import { Collection, MongoClient } from "mongodb"
import CONFIG from "../../config"
import { UsageAccount, UsageRequest } from "./interfaces"

const DSN = CONFIG.verida.usageDb.dsn
const DB_NAME = CONFIG.verida.usageDb.dbName
const ACCOUNTS_COLLECTION = CONFIG.verida.usageDb.accountsCollection
const REQUEST_COLLECTION = CONFIG.verida.usageDb.requestsCollection

export function nowTimestamp() {
    return new Date().toISOString()
}

class UsageManager {

    private client?: MongoClient

    public async connectAccount(appDID: string, userDID: string) {
        if (!await this.init()) {
            return
        }

        const usageAccount: UsageAccount = {
            appDID,
            userDID,
            insertedAt: nowTimestamp()
        }

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)

        try {
            await collection.insertOne(usageAccount)
        } catch (err) {
            if (err.message.match('duplicate key error')) {
                // Already exists
                return
            }

            throw new Error(`Unable to link user and DID`)
        }
    }

    public async logRequest(usageRequest: UsageRequest) {
        if (!await this.init()) {
            return
        }

        const collection = await this.getCollection(REQUEST_COLLECTION)

        usageRequest.insertedAt = nowTimestamp()
        await collection.insertOne(usageRequest)
    }

    public async getRequests(did: string): Promise<any> {
        if (!await this.init()) {
            return {}
        }

        const collection = await this.getCollection(REQUEST_COLLECTION)
        return collection.find({}).toArray()
    }

    public async buildIndexes() {
        try {
            if (!await this.init()) {
                return
            }

            const accountCollection = await this.getCollection(ACCOUNTS_COLLECTION)
            await accountCollection.createIndex({
                appDID: 1,
                userDID: 1
            }, {
                unique: true
            })

            const requestCollection = await this.getCollection(REQUEST_COLLECTION)
            await requestCollection.createIndex({
                appDID: 1,
                insertedAt: 1
            })
        } catch (err) {
            console.log(err)
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
            console.log("Connected to MongoDB!");
        } catch (err) {
            console.error("Error connecting to MongoDB", err);
            throw new Error(`Unable to connect to usage database`)
        }

        return true
    }
}

const manager = new UsageManager()
export default manager