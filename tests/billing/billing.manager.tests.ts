const assert = require("assert");
import CONFIG from "../../src/config"
import BillingManager from "../../src/services/billing/manager"
import AlchemyManager from "../../src/services/billing/alchemy"
import { Utils } from "alchemy-sdk"

import { BillingAccount, BillingAccountType, BillingDeposit, BillingTxnType } from "../../src/services/billing/interfaces";
import { UsageRequest } from "../../src/services/usage/interfaces";

const ACCOUNTS_COLLECTION = CONFIG.verida.centralDb.accountsCollection
const DEPOSIT_COLLECTION = CONFIG.verida.centralDb.depositsCollection
const USER_CREDITS_PER_REQUEST = CONFIG.verida.billing.userCreditsPerRequest

/**
 * WARNING: These tests clear deposit and account collections after running, so never
 * run these tests on production
 */
describe(`Billing tests`, function () {
    this.timeout(200 * 1000)

    // Example test DIDs
    const appDID = "did:vda:polpos:0x7b41972827390b5fF6a938D8fF8eC68cf0535134"
    const userDID = "did:vda:polpos:0x0E678a24101bc17d8E6409a78f9c9fEE637d9ACE"

    it(`Can register an account`, async() => {
        // Register the account so it has some free credits
        await BillingManager.registerAccount(appDID, BillingAccountType.APP)

        const accountCollection = await BillingManager.getCollection(ACCOUNTS_COLLECTION)
        const depositCollection = await BillingManager.getCollection(DEPOSIT_COLLECTION)

        const appAccount = await accountCollection.findOne<BillingAccount>({
            did: appDID
        })

        assert.equal(appAccount?.did, appDID, 'App DID matches')
        assert.deepEqual(appAccount?.tokens, { free: '200000000000000000000', owned: '0' }, 'App tokens match')

        const appDeposits = await depositCollection.find<BillingDeposit>({
            did: appDID
        }).toArray()

        assert.ok(appDeposits.length, 'Have a deposit')
        const appDeposit = appDeposits[0]
        assert.equal(appAccount?.did, appDeposit.did, 'Deposit DID matches')
        assert.equal(appDeposit.tokens, '200000000000000000000', 'Deposit tokens matches')
        assert.equal(appDeposit.txnType, 'free', 'Deposit txn type matches')
        assert.equal(appDeposit.description, 'Free welcome credits', 'Deposit description matches')
    })

    it(`Can deposit VDA tokens`, async() => {
        // Deposit 10 VDA to user account
        await BillingManager.deposit({
            did: userDID,
            tokens: Utils.parseUnits("10", 18).toString(),
            description: "Test deposit",
            txnType: BillingTxnType.CRYPTO
        })

        const depositCollection = await BillingManager.getCollection(DEPOSIT_COLLECTION)
        const userDeposits = await depositCollection.find<BillingDeposit>({
            did: userDID
        }).toArray()

        assert.ok(userDeposits.length, 'Have a deposit')
        const userDeposit = userDeposits[0]
        assert.equal(userDID, userDeposit.did, 'Deposit DID matches')
        assert.equal(userDeposit.tokens, '10000000000000000000', 'Deposit tokens matches')
        assert.equal(userDeposit.txnType, 'crypto', 'Deposit txn type matches')
        assert.equal(userDeposit.description, 'Test deposit', 'Deposit description matches')

        // User balance is correct
        const userBalance = await BillingManager.getTokens(userDID)
        assert.equal(userBalance.free, "0", "Free tokens matches")
        assert.equal(userBalance.owned, "10000000000000000000", "Owned tokens matches")

        // Deposit 15 VDA to app account
        await BillingManager.deposit({
            did: appDID,
            tokens: Utils.parseUnits("15", 18).toString(),
            description: "Test deposit",
            txnType: BillingTxnType.CRYPTO
        })

        const appDeposits = await depositCollection.find<BillingDeposit>({
            did: appDID
        }).toArray()

        assert.ok(appDeposits.length == 2, 'Have two deposits')
        const appDeposit = appDeposits[1]
        assert.equal(appDID, appDeposit.did, 'Deposit DID matches')
        assert.equal(appDeposit.tokens, '15000000000000000000', 'Deposit tokens matches')
        assert.equal(appDeposit.txnType, 'crypto', 'Deposit txn type matches')
        assert.equal(appDeposit.description, 'Test deposit', 'Deposit description matches')

        // App balance is correct
        const appBalance = await BillingManager.getTokens(appDID)
        assert.equal(appBalance.free, "200000000000000000000", "Free tokens matches")
        assert.equal(appBalance.owned, "15000000000000000000", "Owned tokens matches")
    })

    it(`Can handle an app request`, async() => {
        const credits1 = 10
        const appBalance = await BillingManager.getBalance(appDID)
        const userBalance = await BillingManager.getBalance(userDID)

        // 10 credit request
        const request: UsageRequest = {
            userDID,
            appDID,
            credits: credits1,
            latency: 0,
            resultSize: 0,
            path: "/"
        }

        const vdaAmount1 = await BillingManager.convertCreditsToVDA(credits1)
        await BillingManager.handleRequest(request, BillingAccountType.APP)

        // Ensure the application token balance has reduced by 10 credits
        const newAppBalance = await BillingManager.getBalance(appDID)
        const appTokens = await BillingManager.getTokens(appDID)

        const expectedAppBalance = BigInt(appBalance.toString()) - BigInt(Utils.parseUnits(vdaAmount1.toString(), 18).toString())
        assert.equal(newAppBalance, expectedAppBalance, 'New app balance matches expected balance')

        // Ensure the user token balance has increased
        const newUserBalance = await BillingManager.getBalance(userDID)

        const vdaAmount2 = await BillingManager.convertCreditsToVDA(USER_CREDITS_PER_REQUEST)
        const expectedUserBalance = BigInt(userBalance.toString()) + BigInt(Utils.parseUnits(vdaAmount2.toString(), 18).toString())
        assert.equal(newUserBalance, expectedUserBalance, 'New app balance matches expected balance')

        // Ensure all free tokens are consumed and some owned tokens are consumed
        const currentVDAPrice = await AlchemyManager.getVDAPrice()
        // Calculate how many credits to consume in a request to use up all free tokens
        const freeTokens = parseFloat(Utils.formatUnits(appTokens.free.toString()))

        // Calculate how many credits need to be in a request to ensure all free credits are used up
        const credits2 = (freeTokens * 100.0 * currentVDAPrice) + 1.0
        const request2: UsageRequest = {
            userDID,
            appDID,
            credits: credits2,
            latency: 0,
            resultSize: 0,
            path: "/"
        }

        const vdaAmount3 = await BillingManager.convertCreditsToVDA(credits2)
        await BillingManager.handleRequest(request2, BillingAccountType.APP)

        const appTokens2 = await BillingManager.getTokens(appDID)
        const appBalance2 = await BillingManager.getBalance(appDID)

        assert.equal(appTokens2.free.toString(), "0", "No free tokens")
        const expectedAppBalance2 = BigInt(expectedAppBalance.toString()) - BigInt(Utils.parseUnits(vdaAmount3.toString(), 18).toString())
        assert.equal(expectedAppBalance2, appBalance2, "App balance has expected value")
    })

    it(`Can handle a user request`, async() => {
        // Deposit 1 free token
        await BillingManager.deposit({
            did: userDID,
            tokens: Utils.parseUnits("1", 18).toString(),
            description: "Free tokens",
            txnType: BillingTxnType.FREE
        })

        const credits = 10
        const userTokens = await BillingManager.getTokens(userDID)
        const userBalance = await BillingManager.getBalance(userDID)

        // 10 credit request
        const request: UsageRequest = {
            userDID,
            credits,
            latency: 0,
            resultSize: 0,
            path: "/"
        }

        const vdaAmount = await BillingManager.convertCreditsToVDA(credits)
        await BillingManager.handleRequest(request, BillingAccountType.USER)

        // Ensure the application token balance has reduced by 10 credits
        const newUserBalance = await BillingManager.getBalance(userDID)
        const userTokens2 = await BillingManager.getTokens(userDID)

        const expectedUserBalance = BigInt(userBalance.toString()) - BigInt(Utils.parseUnits(vdaAmount.toString(), 18).toString())
        assert.equal(newUserBalance, expectedUserBalance, 'New app balance matches expected balance')
        assert.equal(userTokens2.free, "0", "Free token balance is zero")
    })

    it(`Can get an alchemy transaction`, async() => {
        const result = await AlchemyManager.getTransaction("0xa4a8c94184b4677fd71f4a50e4230ebabe2694194aebc507e29a11e272e18242")

        assert.ok(result, 'Have a result')
        assert.equal(result.from, "0x35d254687c4e8c7c1d49785dbf4b792f86ad1907", "Correct from value")
        assert.equal(result.to, "0xcf05d450b08d3fa49da476deb825dc211160a9d5", "Correct to value")
        assert.equal(result.amount, BigInt("748879093268939383562"), "Correct amount value")
    })

    it(`Can get a VDA token price`, async() => {
        const result = await AlchemyManager.getVDAPrice()
        assert.ok(typeof result == "number", 'Result is a valid number')
    })

    this.afterAll(async () => {
        const accountCollection = await BillingManager.getCollection(ACCOUNTS_COLLECTION)
        await accountCollection.drop()

        const depositCollection = await BillingManager.getCollection(DEPOSIT_COLLECTION)
        await depositCollection.drop()

        console.log('Dropped accounts and deposits')
        await BillingManager.shutdown()
    })
})