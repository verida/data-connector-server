const assert = require("assert")
import CONFIG from '../src/config'
import Providers from '../src/providers'

const SCHEMA_FOLLOWING = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'
const SCHEMA_POST = 'https://common.schemas.verida.io/social/post/v0.1.0/schema.json'

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = CONFIG.logLevel

const providerName = 'facebook'
const providerConfig = CONFIG.providers[providerName]
const creds = providerConfig.testing

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    describe("Fetch API data", () => {
        //let syncResult
        const provider = Providers(providerName)

        it("Can fetch Post data", async () => {
            const syncData = await provider.sync(creds.accessToken, '', SCHEMA_POST)

            assert.ok(syncData, 'Have data returned')
            assert.ok(SCHEMA_POST in syncData, 'Have Post data in the response')
            assert.equal(syncData[SCHEMA_POST].length, providerConfig.postLimit, `Correct number of posts received`)
        })

        it("Can fetch Following data", async () => {
            const syncData = await provider.sync(creds.accessToken, '', SCHEMA_FOLLOWING)

            assert.ok(syncData, 'Have data returned')
            assert.ok(SCHEMA_FOLLOWING in syncData, 'Have Following data in the response')
            assert.equal(syncData[SCHEMA_FOLLOWING].length, providerConfig.followingLimit, `Correct number of following records received`)
        })
    })
})

// did: did:vda:0x58D76cbe26e6F7607A67E7B38eEd7700F660BF4B
// accessToken: EAAP5ZANvAUzMBAI0ozmZB0cdNjgnZAR7ZBi0E1epB430J6gL3s9uhTQaqxWOwGbvZA3kouYTHSD2XCyycIngAraJAcQvqpDKZCu4E8HBzIHcGfpGN8tvS0fYsb9pi5Yx76aoqMKmvCulmsZA5u3f8FeuT0PNAVYIZCxdjutLXqOasZBlDPYXGmviKD2MZAyCdkZBByzRAAlrDKeftotD7ZAYuXERvvDvYJGVqRX6xDk7TEPgLu6rtWZCVwFpK