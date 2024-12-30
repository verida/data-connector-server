const assert = require("assert");
import { AuthRequestObject } from "../../src/api/rest/v1/oauth/interfaces";
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"

const NOW = Math.floor(Date.now() / 1000)
const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1/oauth`
const USER_DID = "0x"
const SCOPES = [""]

const APP_DID = "0x"
const APP_REDIRECT_URI = "https://insertyourdomain.com/verida/auth-response"

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
  });

describe(`OAuth tests`, function () {
    it(`Can ge`, async () => {
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
            const response = await axios.get(`${ENDPOINT}/auth`, {
                params: request
            })

            const authCode = response.data.auth_code

            console.log('Auth code', authCode)
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
        }
    })
})