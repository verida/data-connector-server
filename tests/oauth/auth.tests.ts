const assert = require("assert");
import { AuthRequestObject } from "../../src/api/rest/v1/oauth/interfaces";
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"
import { AutoAccount } from "@verida/account-node";
import { Client } from "@verida/client-ts";
import { buildContextSession } from "./utils";

const VERIDA_CONTEXT = 'Verida: Vault'
const NOW = Math.floor(Date.now() / 1000)
const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1/oauth`
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

describe(`OAuth tests`, function () {
    this.timeout(200 * 1000)

    let authCode, refreshToken, USER_DID, APP_DID

    it(`Can get an auth code`, async () => {
        USER_DID = await userAccount.did()
        APP_DID = await appAccount.did()

        const ARO: AuthRequestObject = {
            appDID: APP_DID,
            userDID: USER_DID,
            scopes: SCOPES,
            timestamp: NOW
        }

        // Sign the ARO to generate a consent signature verifying the user account consents to this request
        const userKeyring = await userAccount.keyring(VERIDA_CONTEXT)
        const user_sig = await userKeyring.sign(ARO)

        // Sign the ARO to generate a consent signature verifying the app account generated this request
        const appKeyring = await appAccount.keyring(VERIDA_CONTEXT)
        const app_sig = await appKeyring.sign(ARO)

        // Add custom state data that will be passed back to the third party application on successful login
        const state = {}

        const request = {
            client_id: APP_DID,
            auth_request: JSON.stringify(ARO),
            redirect_uri: APP_REDIRECT_URI,
            user_sig,
            app_sig,
            state: JSON.stringify(state),
            return_code: true
        }

        await client.connect(userAccount)

        const contextSession = await buildContextSession(userAccount, client)
        const stringifiedSession = JSON.stringify(contextSession)
        const sessionToken = Buffer.from(stringifiedSession).toString("base64")

        try {
            const response = await axios.post(`${ENDPOINT}/auth`, {
                data: request,
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })

            authCode = response.data.auth_code

            console.log('Auth code', authCode)
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
        }
    })

    it(`Can get tokens from auth code`, async() => {
        const request = new URLSearchParams()
        request.append('grant_type', 'authorization_code')
        request.append('code', authCode)
        request.append('redirect_uri', APP_REDIRECT_URI)
        request.append('client_id', APP_DID)
        request.append('client_secret', 'missing')

        try {
            const response = await axios.post(`${ENDPOINT}/token`, request, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })

            console.log('Response', response.data)

            refreshToken = response.data.refresh_token
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
        }
    })

    it(`Can refresh an access token`, async() => {
        const request = new URLSearchParams()
        request.append('grant_type', 'refresh_token')
        request.append('refresh_token', refreshToken)
        request.append('client_id', APP_DID)
        request.append('client_secret', 'missing')

        try {
            const response = await axios.post(`${ENDPOINT}/token`, request, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })

            console.log('Response', response.data)
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
        }
    })

    it(`Can revoke access to a third party application`, async() => {
        // @todo Implement on server

        // try {
        //     const response = await axios.get(`${ENDPOINT}/revoke?client_id=${APP_DID}`)

        //     console.log('Response', response.data)
        // } catch (err) {
        //     console.error(err.message)
        //     console.error(err.response)
        // }
    })
})