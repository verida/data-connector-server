const assert = require("assert");
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"
import BillingManager, { AccountType } from "../../src/services/billing/manager"
import AlchemyManager from "../../src/services/billing/alchemy"

import { appAccount, authenticate, buildClient, buildSessionToken, revokeToken } from "../auth/utils";

const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1`
const GRANTED_DATASTORE = "https://common.schemas.verida.io/social/post/v0.1.0/schema.json"

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
});

describe(`Auth tests`, function () {
    this.timeout(200 * 1000)

    let authCode, userSessionToken, sessionToken, appDID, client

    this.beforeAll(async () => {
        client = buildClient()
        await client.connect(appAccount)
        sessionToken = await buildSessionToken(appAccount, client)
        appDID = await appAccount.did()
    })

    it(`Can register an account`, async() => {
        // Register the account so it has some free credits
        await BillingManager.registerAccount(appDID, AccountType.APP)
    })

    it(`Can make a valid scoped request`, async() => {
        try {
            const authResponse = await authenticate([
                "api:ds-query",
                "api:search-ds",
                `ds:r:${GRANTED_DATASTORE}`
            ])

            authCode = authResponse.authCode
            appDID = authResponse.APP_DID
            userSessionToken = authResponse.sessionToken
        } catch (err) {
            console.log(err)
            throw err
        }

        try {
            // Make ds search (granted datastore)
            const response = await axios.post(`${ENDPOINT}/search/datastore/${btoa(GRANTED_DATASTORE)}`, {
                keywords: "phone number",
                index: ["name"]
            }, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                }
            })

            assert.ok(response.data, "Response")
            assert.ok(response.data.total >= 0, "Valid response")
        } catch (err) {
            console.log(err)
            assert.fail('Failed to search granted datastore')
        }
    })

    it(`Can get requests`, async() => {
        try {
            // Make ds search (granted datastore)
            const response = await axios.get(`${ENDPOINT}/app/requests`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })
            
            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.results.length, 'Have results')
        } catch (err) {
            console.log(err.response.data)
            // assert.fail('Failed to search granted datastore')
        }
    })

    it(`Can get connected accounts count`, async() => {
        try {
            // Make ds search (granted datastore)
            const response = await axios.get(`${ENDPOINT}/app/account-count`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })
            
            console.log(response.data)
            assert.ok(response.data, 'Have a response')
            assert.ok(typeof response.data.count !== 'undefined', 'Have count')
        } catch (err) {
            console.log(err)
            assert.fail('Failed to search granted datastore')
        }
    })

    it(`Can get usage`, async() => {
        try {
            // Make ds search (granted datastore)
            const response = await axios.get(`${ENDPOINT}/app/usage`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })
            
            console.log(response.data)
            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.usage, 'Have usage data')
        } catch (err) {
            console.log(err)
            assert.fail('Failed to search granted datastore')
        }
    })

    it(`Can get balance`, async() => {
        try {
            // Make ds search (granted datastore)
            const response = await axios.get(`${ENDPOINT}/app/balance`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })
            
            console.log(response.data)
        } catch (err) {
            console.log(err)
            assert.fail('Failed to search granted datastore')
        }
    })

    it.skip(`Can deposit VDA tokens`, async() => {
        try {
            // Make ds search (granted datastore)
            const response = await axios.post(`${ENDPOINT}/app/deposit`, {
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })
            
            console.log(response.data)
        } catch (err) {
            console.log(err)
            assert.fail('Failed to search granted datastore')
        }
    })

    it(`Can get an alchemy transaction`, async() => {
        const result = await AlchemyManager.getTransaction("0x3ad745c13f212f063e23429a3ac2eaf05d69bfca71bf8657edcee99d4af6ede2")
        console.log(result)
        // console.log(result.amount.toString())
    })

    it(`Can get a VDA token price`, async() => {
        const result = await AlchemyManager.getVDAPrice()
        console.log(result)
        // console.log(result.amount.toString())
    })

    this.afterAll(async () => {
        await revokeToken(authCode, userSessionToken)
    })
})