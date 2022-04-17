const assert = require("assert")
import CONFIG from "../src/config"
import CommonUtils from "./common.utils"
import CommonTests from "./common.tests"

const SCHEMA_FOLLOWING = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

const provider = 'twitter'
const creds = CONFIG.connectors[provider].testing

describe(`${provider} Tests`, function() {
    this.timeout(100000)
    const nonce = '1'
    let connection

    describe("Sync", () => {
        let syncResult

        it("Can sync", async () => {
            connection = await CommonUtils.getNetwork()
            syncResult = await CommonUtils.syncConnector(provider, creds.accessToken, creds.refreshToken, connection.did, nonce)

            assert.ok(syncResult, 'Have a sync result')
            assert.ok(syncResult.data, 'Have sync result data')
            assert.equal(syncResult.data.did, connection.did, 'Expected DID returned')
            assert.equal(syncResult.data.contextName, 'Verida: Data Connector', 'Have expected context name')
        })

        it("Has valid following schema data", async () => {
            await CommonTests.syncHasValidSchemaData(syncResult, connection, SCHEMA_FOLLOWING, 5)
        })
    })
})