const assert = require("assert");
import { authenticate } from "../auth/utils"
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"

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

    let authCode

    it(`Can issue an auth token for a third party app`, async () => {
        const authResponse = await authenticate([])
        authCode = authResponse.authCode

        try {
            const response = await axios.get(`${ENDPOINT}/app/usage`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
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
})