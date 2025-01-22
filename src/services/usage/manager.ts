import { Collection, MongoClient } from "mongodb"
import CONFIG from "../../config"
import { UsageAccount, UsageRequest, UsageStats } from "./interfaces"

const DSN = CONFIG.verida.centralDb.dsn
const DB_NAME = CONFIG.verida.centralDb.dbName
const APP_USERS_COLLECTION = CONFIG.verida.centralDb.appUsersCollection
const REQUEST_COLLECTION = CONFIG.verida.centralDb.requestsCollection
const ACCOUNT_COLLECTION = CONFIG.verida.centralDb.accountsCollection

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

        const collection = await this.getCollection(APP_USERS_COLLECTION)
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

        const requestCollection = await this.getCollection(REQUEST_COLLECTION)
        usageRequest.insertedAt = nowTimestamp()
        await requestCollection.insertOne(usageRequest)

        const accountCollection = await this.getCollection(ACCOUNT_COLLECTION)
        // @todo: decrement account credits
        // @todo: increment user credits
    }

    public async getRequests(did: string): Promise<any> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        const collection = await this.getCollection(REQUEST_COLLECTION)
        return await collection.find({
            appDID: did
        }).toArray()
    }

    public async getAccountCount(did: string): Promise<number> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        const collection = await this.getCollection(APP_USERS_COLLECTION)
        return collection.countDocuments({
            appDID: did
        })
    }

    public async getUsageStats(did: string, startTime?: string, endTime?: string): Promise<UsageStats> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        const match: any = {
            appDID: did
        }

        if (startTime || endTime) {
            const insertedAt: Record<string, string> = {}
            if (startTime) {
                insertedAt['$gte'] = startTime
            }
            if (endTime) {
                insertedAt['$lte'] = endTime
            }

            match.insertedAt = insertedAt
        }

        const collection = await this.getCollection(REQUEST_COLLECTION)
        const results = await collection.aggregate([
            {
              // Filter documents by the specified time range (start and end timestamps)
              $match: match
            },
            {
              // Group by an empty group (since we want aggregate results for the whole collection)
              $group: {
                _id: null,  // Grouping everything together
                connectedAccounts: { $addToSet: "$userDID" },  // Collect unique userDID (distinct connected accounts)
                requests: { $sum: 1 },  // Count total requests (documents)
                resultSize: { $sum: { $toInt: "$resultSize" } }  // Sum the resultSize values (converted to integers)
              }
            },
            {
              // Add a field with the count of connected accounts
              $project: {
                connectedAccounts: { $size: "$connectedAccounts" },  // Count of distinct connected accounts
                requests: 1,  // Total requests
                resultSize: 1  // Total resultSize
              }
            }
          ]).toArray()

          if (!results.length) {
            return {
                requests: 0,
                connectedAccounts: 0,
                resultSize: 0
            }
          }

          delete results[0]['_id']
          return <UsageStats> results[0]
    // }
    }

    public async buildIndexes() {
        try {
            if (!await this.init()) {
                return
            }

            const appUsersCollection = await this.getCollection(APP_USERS_COLLECTION)
            await appUsersCollection.createIndex({
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
        } catch (err) {
            console.error("Error connecting to MongoDB", err);
            throw new Error(`Unable to connect to usage database`)
        }

        return true
    }
}

const manager = new UsageManager()
export default manager