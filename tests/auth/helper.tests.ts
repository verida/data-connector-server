const assert = require("assert");
import { KMS } from "../../src/api/rest/v1/oauth/kms"

describe(`OAuth helper tests`, function () {
    it(`Can generate valid API keys`, async () => {
        const fakeSession = {
            sessionId: 1,
            data: 2
        }

        const ownerDid = ``
        const requestingDid = ``

        const apiKey = await KMS.generateApiKey(fakeSession, requestingDid)
        const veridaSession = await KMS.getSessionFromApiKey(ownerDid, requestingDid, apiKey)

        // @todo verify veridaSession = fakeSession
    })
})