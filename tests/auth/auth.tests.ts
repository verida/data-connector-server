const assert = require("assert");
import { AuthRequest } from "../../src/api/rest/v1/auth/interfaces";
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"
import { AutoAccount } from "@verida/account-node";
import { Client } from "@verida/client-ts";
import { buildContextSession } from "./utils";
import { expandScopes } from "../../src/api/rest/v1/auth/scopes";

const VERIDA_CONTEXT = 'Verida: Vault'
const NOW = Math.floor(Date.now() / 1000)
const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1/auth`
const SCOPES = ["test-scope"]
const APP_REDIRECT_URI = "https://insertyourdomain.com/verida/auth-response"

const userAccount = new AutoAccount({
    privateKey: CONFIG.verida.testVeridaKey,
    network: CONFIG.verida.testVeridaNetwork,
    didClientConfig: CONFIG.verida.didClientConfig
})

const appAccount = new AutoAccount({
    privateKey: CONFIG.verida.serverKey,
    network: CONFIG.verida.testVeridaNetwork,
    didClientConfig: CONFIG.verida.didClientConfig
})

const client = new Client({
    network: CONFIG.verida.testVeridaNetwork,
    didClientConfig: CONFIG.verida.didClientConfig
})

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
});

describe(`Auth tests`, function () {
    this.timeout(200 * 1000)

    let authCode, USER_DID, APP_DID, sessionToken, userAuthToken

    it(`Can issue an auth token for a third party app`, async () => {
        await client.connect(userAccount)

        // Build a context session object, this would normally be done in the user's web browser
        // once they have logged in
        const contextSession = await buildContextSession(userAccount, client)
        const stringifiedSession = JSON.stringify(contextSession)
        sessionToken = Buffer.from(stringifiedSession).toString("base64")

        USER_DID = await userAccount.did()
        APP_DID = await appAccount.did()

        const ARO: AuthRequest = {
            appDID: APP_DID,
            userDID: USER_DID,
            scopes: SCOPES,
            timestamp: NOW
        }

        // Sign the ARO to generate a consent signature verifying the user account consents to this request
        const userKeyring = await userAccount.keyring(VERIDA_CONTEXT)
        const user_sig = await userKeyring.sign(ARO)

        // Add custom state data that will be passed back to the third party application on successful login
        const state = {}

        const request = {
            client_id: APP_DID,
            auth_request: JSON.stringify(ARO),
            redirect_uri: APP_REDIRECT_URI,
            user_sig,
            // app_sig,
            state: JSON.stringify(state)
        }

        try {
            const response = await axios.post(`${ENDPOINT}/auth`, request, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })

            const redirectUrl = response.data.redirectUrl
            const parsedUrl = new URL(redirectUrl)
            authCode = parsedUrl.searchParams.get("auth_token")
            authCode = decodeURIComponent(authCode)

            assert.ok(authCode, 'Have an auth code')
        } catch (err) {
            assert.fail(`Failed: ${err.message}`)
        }
    })

    it(`Can make a valid scoped request`, async() => {
        try {
            const response = await axios.get(`${ENDPOINT}/check-scope?scope=test-scope`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                  }
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.authenticated, true, 'Successfully authenticated')
        } catch (err) {
            console.error(err.message)
            console.error(err.response.data)
            assert.fail('Failed')
        }
    })

    it(`Can make an invalid scoped request`, async() => {
        try {
            const response = await axios.get(`${ENDPOINT}/check-scope?scope=invalid-scope`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                }
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.authenticated, false, 'Failed authentication')
        } catch (err) {
            console.error(err.message)
            console.error(err.response.data)
            assert.fail('Failed')
        }
    })

    it(`Can fetch auth tokens`, async() => {
        try {
            const response = await axios.get(`${ENDPOINT}/tokens`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.tokens.length, 'Have tokens')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can fetch info for current token`, async() => {
        try {
            const response = await axios.get(`${ENDPOINT}/token?tokenId=${encodeURIComponent(authCode)}`)

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.token && response.data.token._id, 'Have token data')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can't revoke an auth token using an auth token`, async() => {
        try {
            const tokenId = authCode.substring(0,36)
            await axios.get(`${ENDPOINT}/revoke?tokenId=${tokenId}`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                }
            })

            assert.fail('Incorrectly revoked auth token')
        } catch (err) {
            if (err.response.status == 403) {
                assert.ok(err.response.data.error.match('Invalid token'), 'No credentials error correctly returned')
            } else {
                console.error(err.message)
                console.error(err.response)
                assert.fail('Failed')
            }
        }
    })

    it(`Can revoke an auth token`, async() => {
        try {
            const tokenId = authCode.substring(0,36)
            const response = await axios.get(`${ENDPOINT}/revoke?tokenId=${tokenId}`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                },
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.revoked, true, 'Successfully revoked token')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
        }
    })

    it(`Can no longer use revoked token`, async() => {
        try {
            await axios.get(`${ENDPOINT}/check-scope?scope=test-scope`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                }
            })

            assert.fail('Revoked token was successfully used')
        } catch (err) {
            if (err.response.status == 403) {
                assert.ok(err.response.data.error.match('Invalid token'), 'Invalid token error returned')
            } else {
                console.error(err.message)
                console.error(err.response.data)
                assert.fail('Failed')
            }
        }
    })

    it(`Can issue an auth token to a user`, async () => {
        try {
            const response = await axios.post(`${ENDPOINT}/token`, {
                scopes: SCOPES
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                },
            })

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.token, 'Have a token')
            userAuthToken = response.data.token
        } catch (err) {
            console.error(err.message)
            console.error(err.response.data)
            assert.fail('Failed')
        }
    })

    it(`Can revoke a user generated auth token`, async() => {
        try {
            const tokenId = userAuthToken.substring(0,36)
            const response = await axios.get(`${ENDPOINT}/revoke?tokenId=${tokenId}`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                },
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.revoked, true, 'Successfully revoked token')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can get a list of all supported scopes`, async() => {
        try {
            const response = await axios.get(`${ENDPOINT}/scopes`)

            // console.log(response.data.scopes)

            assert.ok(response.data, 'Have a response')
            assert.ok(Object.keys(response.data.scopes).length, 'Have scopes')
            assert.ok(response.data.scopes["ds:r:file"].description, 'Scopes have a description')
        } catch (err) {
            console.error(err)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can successfully expand supported scopes`, async() => {
        const testSchemaUrl = "https://common.schemas.verida.io/social/event/v0.1.0/schema.json"
        const b64Url = Buffer.from(testSchemaUrl).toString('base64')

        const fileSchema = "https://common.schemas.verida.io/file/v0.1.0/schema.json"
        const favouriteSchema = "https://common.schemas.verida.io/favourite/v0.1.0/schema.json"
        const socialEventSchema = "https://common.schemas.verida.io/social/event/v0.1.0/schema.json"

        const testScopes = [
            "ds:r:file",
            "ds:rw:favourite",
            "ds:rwd:social-event",
            "db:r:file",
            "db:rw:favourite",
            "db:rwd:social_event",
            `ds:rwd:base64/${b64Url}`,
            "api:llm-agent-prompt"
        ]        

        const expandedScopes = expandScopes(testScopes)

        const expectedScopes = [
            `ds:r:${fileSchema}`,
            `ds:r:${favouriteSchema}`,
            `ds:w:${favouriteSchema}`,
            `ds:r:${socialEventSchema}`,
            `ds:w:${socialEventSchema}`,
            `ds:d:${socialEventSchema}`,
            'db:r:file',
            'db:r:favourite',
            'db:w:favourite',
            'db:r:social_event',
            'db:w:social_event',
            'db:d:social_event',
            `ds:r:${testSchemaUrl}`,
            `ds:w:${testSchemaUrl}`,
            `ds:d:${testSchemaUrl}`,
            "api:llm-agent-prompt"
          ]

          assert.deepEqual(expectedScopes, expandedScopes, 'Expanded scopes match expected scopes')
    })
    
})