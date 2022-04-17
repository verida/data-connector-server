const assert = require("assert")
import CONFIG from "../src/config"
import CommonUtils from "./common.utils"
import CommonTests from "./common.tests"

const SCHEMA_FOLLOWING = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

const provider = 'twitter'
const creds = CONFIG.providers[provider].testing

describe(`${provider} Tests`, function() {
    this.timeout(100000)
    let connection

    describe("Sync", () => {
        let syncResult

        it("Can sync", async () => {
            connection = await CommonUtils.getNetwork()
            syncResult = await CommonUtils.syncConnector(provider, creds.accessToken, creds.refreshToken, connection.did)
            await CommonTests.hasValidSyncResult(syncResult, connection)
        })

        it("Has valid following schema data", async () => {
            await CommonTests.syncHasValidSchemaData(syncResult, connection, SCHEMA_FOLLOWING, 5)
        })
    })
})