const assert = require("assert")
import serverconfig from '../src/serverconfig.json'
import Providers from '../src/providers'

const SCHEMA_FOLLOWING = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'
const SCHEMA_POST = 'https://common.schemas.verida.io/social/post/v0.1.0/schema.json'

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = serverconfig.logLevel

const providerName = 'twitter'
const providerConfig = serverconfig.providers[providerName]
const creds = providerConfig.testing

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    describe("Fetch API data", () => {
        //let syncResult
        const provider = Providers(providerName)

        it("Can fetch Post data", async () => {
            const syncData = await provider.sync(creds.accessToken, creds.refreshToken, SCHEMA_POST)

            assert.ok(syncData, 'Have data returned')
            assert.ok(SCHEMA_POST in syncData, 'Have Post data in the response')
            assert.equal(syncData[SCHEMA_POST].length, providerConfig.postLimit, `Correct number of posts received (${syncData[SCHEMA_POST].length} != ${providerConfig.postLimit})`)
        })

        it("Can fetch Following data", async () => {
            const syncData = await provider.sync(creds.accessToken, creds.refreshToken, SCHEMA_FOLLOWING)

            assert.ok(syncData, 'Have data returned')
            assert.ok(SCHEMA_FOLLOWING in syncData, 'Have Following data in the response')
            assert.equal(syncData[SCHEMA_FOLLOWING].length, providerConfig.followingLimit, `Correct number of following records received`)
        })
    })
})