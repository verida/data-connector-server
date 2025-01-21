const assert = require("assert");
import { appAccount, buildContextSession } from "../auth/utils"
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"
import { Client } from "@verida/client-ts";
// import UsageManager from "../../src/services/usage/manager"

const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1`

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
});

describe(`Auth tests`, function () {
    this.timeout(200 * 1000)

    let appDID, sessionToken

    const client = new Client({
        network: CONFIG.verida.testVeridaNetwork,
        didClientConfig: CONFIG.verida.didClientConfig
    })

    this.beforeAll(async () => {
        await client.connect(appAccount)
        const contextSession = await buildContextSession(appAccount, client)
        const stringifiedSession = JSON.stringify(contextSession)
        sessionToken = Buffer.from(stringifiedSession).toString("base64")

        appDID = await appAccount.did()
    })

    // it('Can get usage data directly', async () => {
    //     const appDID = "did:vda:polpos:0x7aC95575817ea8aA5Fe414630bF0388Fc4202540"
    //     console.log(await UsageManager.getAccountCount(appDID))
    //     console.log(await UsageManager.getRequests(appDID))
    //     console.log(await UsageManager.getUsageStats(appDID))
    // })

    it(`Can get app usage`, async () => {
        try {
            const response = await axios.get(`${ENDPOINT}/app/usage`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.stats, 'Have stats')
        } catch (err) {
            console.log(err.response.data)
            console.error(err.message)
            assert.fail('Failed')
        }
    })

    it(`Can get requests`, async () => {
        try {
            const response = await axios.get(`${ENDPOINT}/app/requests`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.results, 'Have results')
            assert.ok(response.data.results.length, 'Have at least one result')
        } catch (err) {
            console.error(err.message)
            assert.fail('Failed')
        }
    })

    it(`Can get connected accounts count`, async () => {
        try {
            const response = await axios.get(`${ENDPOINT}/app/account-count`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })

            assert.ok(response.data, 'Have a response')
            assert.ok(typeof response.data.count !== 'undefined', 'Have count results')
        } catch (err) {
            console.error(err.message)
            assert.fail('Failed')
        }
    })


})