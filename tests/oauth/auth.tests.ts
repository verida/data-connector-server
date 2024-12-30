const assert = require("assert");
import { AuthRequestObject } from "../../src/api/rest/v1/oauth/interfaces";
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"

const NOW = Math.floor(Date.now() / 1000)
const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1/oauth`
const USER_DID = "0xa"
const SCOPES = ["test-scope"]

const APP_DID = "0xb"
const APP_REDIRECT_URI = "https://insertyourdomain.com/verida/auth-response"

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
});

describe(`OAuth tests`, function () {

    let authCode, refreshToken

    it(`Can get an auth code`, async () => {
        const ARO: AuthRequestObject = {
            userDID: USER_DID,
            scopes: SCOPES,
            timestamp: NOW
        }

        const consent_sig = "missing"
        const state = {}

        const request = {
            client_id: APP_DID,
            auth_request: JSON.stringify(ARO),
            redirect_uri: APP_REDIRECT_URI,
            consent_sig,
            state: JSON.stringify(state),
            returnCode: true
        }

        try {
            const response = await axios.post(`${ENDPOINT}/auth`, {
                data: request
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