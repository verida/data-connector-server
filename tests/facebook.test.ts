const assert = require("assert")
import CONFIG from '../src/config'
import Providers from '../src/providers'
import CommonUtils from './common.utils'

const SCHEMA_FOLLOWING = CONFIG.verida.schemas.FOLLOWING
const SCHEMA_POST = CONFIG.verida.schemas.POST

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = CONFIG.logLevel

const providerName = 'facebook'

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    const provider = Providers(providerName)

    describe("Fetch API data", () => {
        const provider = Providers(providerName)

        it("Can fetch Post data", async () => {
            const connection = await CommonUtils.getConnection(providerName)
            const syncConfig = {
                [SCHEMA_POST]: {
                    limit: 20,
                }
            }

            const syncData = await provider.sync(connection.accessToken, '', syncConfig)

            assert.ok(SCHEMA_POST in syncData, 'Have correct schema in the response')
            assert.ok(syncData[SCHEMA_POST].length > 0, `Have results`)
            assert.ok(syncData[SCHEMA_POST].length <= syncConfig[SCHEMA_POST].limit, `Correct number of results received`)
        })

        it("Can fetch Following data", async () => {
            const connection = await CommonUtils.getConnection(providerName)
            const syncConfig = {
                [SCHEMA_FOLLOWING]: {
                    limit: 20,
                }
            }

            const syncData = await provider.sync(connection.accessToken, '', syncConfig)

            console.log(syncData[SCHEMA_FOLLOWING])

            assert.ok(SCHEMA_FOLLOWING in syncData, 'Have correct schema in the response')
            assert.ok(syncData[SCHEMA_FOLLOWING].length > 0, `Have results`)
            assert.ok(syncData[SCHEMA_FOLLOWING].length <= syncConfig[SCHEMA_FOLLOWING].limit, `Correct number of results received`)
        })
    })
})

// did: did:vda:0x58D76cbe26e6F7607A67E7B38eEd7700F660BF4B
// accessToken: EAAP5ZANvAUzMBAI0ozmZB0cdNjgnZAR7ZBi0E1epB430J6gL3s9uhTQaqxWOwGbvZA3kouYTHSD2XCyycIngAraJAcQvqpDKZCu4E8HBzIHcGfpGN8tvS0fYsb9pi5Yx76aoqMKmvCulmsZA5u3f8FeuT0PNAVYIZCxdjutLXqOasZBlDPYXGmviKD2MZAyCdkZBByzRAAlrDKeftotD7ZAYuXERvvDvYJGVqRX6xDk7TEPgLu6rtWZCVwFpK