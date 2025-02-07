import { ClientSession, Collection, MongoClient, Decimal128 } from "mongodb"
import { Utils } from "alchemy-sdk"
import CONFIG from "../../config"
import { UsageRequest } from "../usage/interfaces"
import AuthServer from "../../api/rest/v1/auth/server"
import { BillingAccount, BillingAccountType, BillingDeposit, BillingTxnType } from "./interfaces"
import AlchemyManager from "./alchemy"
import { IDIDDocument, Network as VeridaNetwork } from "@verida/types"

const DSN = CONFIG.verida.centralDb.dsn
const DB_NAME = CONFIG.verida.centralDb.dbName
const ACCOUNTS_COLLECTION = CONFIG.verida.centralDb.accountsCollection
const DEPOSIT_COLLECTION = CONFIG.verida.centralDb.depositsCollection

const APP_DID_FREE_CREDITS = CONFIG.verida.billing.appFreeCredits
const USER_DID_FREE_CREDITS = CONFIG.verida.billing.userFreeCredits
const USER_CREDITS_PER_REQUEST = CONFIG.verida.billing.userCreditsPerRequest

const DEPOSIT_ADDRESS = CONFIG.verida.billing.depositAddress
const NETWORK = <VeridaNetwork> CONFIG.verida.network
const CONTEXT_NAME = "Verida: Vault"

export function nowTimestamp() {
    return new Date().toISOString()
}

class BillingManager {

    private enabled: boolean
    private client?: MongoClient
    private serverDid?: string

    constructor(enabled: boolean) {
        this.enabled = enabled
    }

    public get isEnabled() {
        return this.enabled
    }

    public async getAccount(did: string): Promise<BillingAccount | undefined> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        did = this.normalizeDID(did)

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        const result = await collection.findOne<BillingAccount>({
            did
        })

        return result
    }

    public async registerAccount(did: string, type: BillingAccountType): Promise<boolean> {
        if (!await this.init()) {
            return
        }

        did = this.normalizeDID(did)

        let tokens: BigInt = BigInt(0)
        if (type == BillingAccountType.APP) {
            tokens = this.numberToWei(APP_DID_FREE_CREDITS)
        } else {
            tokens = this.numberToWei(USER_DID_FREE_CREDITS)
        }

        const accountCreated = await this.ensureAccountExists(did)

        if (accountCreated) {
            await this.deposit({
                did,
                tokens: tokens.toString(),
                description: "Free welcome credits",
                txnType: BillingTxnType.FREE
            })
        }

        return accountCreated
    }

    /**
     * 
     * @param did 
     * @returns boolean indicating if the account was created
     */
    public async ensureAccountExists(did: string): Promise<boolean> {
        did = this.normalizeDID(did)
        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        try {
            await collection.insertOne({
                did,
                tokens: {
                    free: "0",
                    owned: "0"
                },
                insertedAt: nowTimestamp()
            })

            return true
        } catch (err) {
            if (err.message.match('duplicate key error')) {
                // Already exists
                return false
            }

            throw new Error(`Unable to create account`)
        }
    }

    public async deposit(depositInfo: Omit<BillingDeposit, "insertedAt">): Promise<void> {
        const depositsCollection = await this.getCollection(DEPOSIT_COLLECTION)
        const accountsCollection = await this.getCollection(ACCOUNTS_COLLECTION)

        depositInfo.did = this.normalizeDID(depositInfo.did)

        const session = this.client.startSession();
        try {
            await session.startTransaction()
            await depositsCollection.insertOne({
                ...depositInfo,
                insertedAt: nowTimestamp()
            }, session)

            await this.ensureAccountExists(depositInfo.did)

            const account = await accountsCollection.findOne<BillingAccount>({
                did: depositInfo.did
            }, session)

            let tokensOwned = BigInt(account.tokens.owned.toString())
            let tokensFree = BigInt(account.tokens.free.toString())
            
            if (depositInfo.txnType == BillingTxnType.FREE) {
                tokensFree += BigInt(depositInfo.tokens.toString())
            } else {
                tokensOwned += BigInt(depositInfo.tokens.toString())
            }

            await accountsCollection.updateOne({
                did: depositInfo.did
            }, {
                $set: { "tokens.owned": tokensOwned.toString(), "tokens.free": tokensFree.toString() }
            }, session)

            await session.commitTransaction()
        } catch (err) {
            console.log(err)
            throw new Error(`Unable to save deposit, already registered`)
        } finally {
            await session.endSession()
        }
    }

    public async verifyCryptoDeposit(didDocument: IDIDDocument, txnId: string, fromAddress: string, amount: number, signature: string): Promise<void> {
        // Verify signature
        const proofMessage = `txn: ${txnId}\nfrom: ${fromAddress}\namount: ${amount}`
        const validSig = didDocument.verifyContextSignature(proofMessage, NETWORK, CONTEXT_NAME, signature, false)
        
        if (!validSig) {
            throw new Error('Invalid deposit signature')
        }

        // Verify deposit
        let result
        try {
            result = await AlchemyManager.getTransaction(txnId)
        } catch (err) {
            console.error(err.message)
            throw new Error(`Invalid deposit: ${err.message}`)
        }

        const expectedValue = this.numberToWei(amount)

        if (result.from.toLowerCase() != fromAddress.toLowerCase()) {
            throw new Error(`From address doesn't match transaction`)
        } else if (result.to.toLowerCase() != DEPOSIT_ADDRESS.toLowerCase()) {
            throw new Error(`Incorrect deposit address`)
        } else if (result.amount != expectedValue) {
            throw new Error(`VDA amount does not match transaction`)
        }
    }

    public async getBalance(did: string): Promise<BigInt> {
        try {
            const tokens = await this.getTokens(did)

            const free = BigInt(tokens.free.toString())
            const owned = BigInt(tokens.owned.toString())
            return BigInt((free + owned).toString())
        } catch (err: any) {
            return BigInt(0)
        }
    }

    public async getTokens(did: string): Promise<{
        free: BigInt,
        owned: BigInt
    }> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        did = this.normalizeDID(did)

        const collection = await this.getCollection(ACCOUNTS_COLLECTION)
        const result = await collection.findOne<BillingAccount>({
            did
        })

        if (!result) {
            throw new Error(`Unable to locate account: ${did}`)
        }

        const free = BigInt(result.tokens.free.toString())
        const owned = BigInt(result.tokens.owned.toString())

        return {
            free,
            owned
        }
    }

    public async getDeposits(did: string): Promise<BillingDeposit[]> {
        if (!await this.init()) {
            throw new Error('Usage not available')
        }

        did = this.normalizeDID(did)

        const collection = await this.getCollection(DEPOSIT_COLLECTION)
        return await collection.find<BillingDeposit>({
            appDID: did
        }).toArray()
    }

    public async handleRequest(request: UsageRequest, payer: BillingAccountType): Promise<void> {
        if (!this.enabled) {
            return
        }
    
        if (request.appDID) {
            await this.ensureAccountExists(request.appDID)
        }

        if (request.userDID) {
            await this.ensureAccountExists(request.userDID)
        }

        const session = this.client.startSession();
        try {
            session.startTransaction();
            if (payer == BillingAccountType.APP) {
                // Application is paying for request
                // Deduct amount from the application credits
                const appVda = await this.convertCreditsToVDA(0 - request.credits)
                await this.consumeTokens(request.appDID, this.numberToWei(appVda), session)

                // Increment amount for the user
                const userVda = await this.convertCreditsToVDA(USER_CREDITS_PER_REQUEST)
                await this.consumeTokens(request.userDID, this.numberToWei(userVda), session)

                // Increment remainder amount for this API node operator
                const nodeVda = await this.convertCreditsToVDA(request.credits - USER_CREDITS_PER_REQUEST)
                await this.consumeTokens(this.serverDid, this.numberToWei(nodeVda), session)

                // console.log(`APP request credits${request.credits}, appVda: ${appVda}, userVda: ${userVda}, nodeVda: ${nodeVda}`)
            } else {
                // User is paying for request
                const userVda = await this.convertCreditsToVDA(0 - request.credits)
                await this.consumeTokens(request.userDID, this.numberToWei(userVda), session)

                // console.log(`USER request credits ${request.credits}, userVda: ${userVda}`)
            }

            // Commit the transaction
            await session.commitTransaction();
        } catch (error) {
            // If an error occurs, abort the transaction
            console.error('Error occurred, aborting transaction', error);
            await session.abortTransaction();
          } finally {
            // End the session
            session.endSession();
          }
    }

    public async convertCreditsToVDA(credits: number): Promise<number> {
        const vdaPrice = await AlchemyManager.getVDAPrice()
        const tokens = (credits / 100.0 / vdaPrice)
        return tokens
    }

    public numberToWei(num: number): BigInt {
        return BigInt(Utils.parseUnits(num.toString(), 18).toString())
    }

    public async hasCredits(did: string, credits: number): Promise<boolean> {
        const vdaAmount = await this.convertCreditsToVDA(credits)
        const balance = await this.getBalance(did)

        if (balance < this.numberToWei(vdaAmount)) {
            return false
        }

        return true
    }

    private async consumeTokens(did: string, tokens: BigInt, session: ClientSession): Promise<void> {
        const accountCollection = await this.getCollection(ACCOUNTS_COLLECTION)
        const amount = BigInt(0) - BigInt(tokens.toString())
      
        // Reduce free tokens first
        const account = await accountCollection.findOne<BillingAccount>({ did }, { session });
        let freeCreditRemaining = BigInt(account.tokens.free.toString()) - BigInt(amount.toString())
        let ownedRemaining = BigInt(account.tokens.owned.toString())
        if (freeCreditRemaining < 0) {
            ownedRemaining += freeCreditRemaining
            freeCreditRemaining = BigInt(0)
        }

        if (ownedRemaining < 0) {
            throw new Error(`Insufficient tokens`)
        }

        await accountCollection.updateOne(
            { did },
            { $set: { "tokens.free": freeCreditRemaining.toString(), "tokens.owned": ownedRemaining.toString() } },
            { session }
        );
      }

    public async getCollection(collectionName: string): Promise<Collection> {
        try {
            await this.init()
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

    public async buildIndexes(): Promise<void> {
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

            const depositsCollection = await this.getCollection(DEPOSIT_COLLECTION)
            await depositsCollection.createIndex({
                txnId: 1
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

        this.serverDid = await AuthServer.getDid()
        await this.ensureAccountExists(this.serverDid)
        return true
    }

    public async shutdown(): Promise<void> {
        await this.client.close()
    }

    private normalizeDID(did: string): string {
        return did.replace('mainnet', 'polpos')
    }
}

const manager = new BillingManager(CONFIG.verida.billing.enabled)
export default manager