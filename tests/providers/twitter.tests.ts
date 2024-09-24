// const assert = require("assert")
// import serverconfig from '../../src/config'
// import Providers from '../../src/providers'
// import CommonUtils from '../common.utils'

// const SCHEMA_FOLLOWING = serverconfig.verida.schemas.FOLLOWING
// const SCHEMA_POST = serverconfig.verida.schemas.POST

// const log4js = require("log4js")
// const logger = log4js.getLogger()
// logger.level = serverconfig.logLevel

// const providerName = 'twitter'
// const providerConfig = serverconfig.providers[providerName]
// const creds = providerConfig.testing

// describe(`${providerName} Tests`, function() {
//     this.timeout(100000)

//     describe("Fetch API data", async () => {
//         //let syncResult
//         const provider = Providers(providerName)

//         it.only("Can fetch Post data", async () => {
//             try {
//                 const connection = await CommonUtils.getConnection(providerName)
//                 console.log(provider)
//                 console.log(connection)
//                 const syncConfig = {
//                     [SCHEMA_POST]: {
//                         limit: 20,
//                     }
//                 }
//                 const syncData = await provider.sync(connection.accessToken, connection.refreshToken, syncConfig)
//                 console.log(syncData)

//                 assert.ok(syncData && Object.keys(syncData).length, 'Have data returned')
//                 assert.ok(SCHEMA_POST in syncData, 'Have Post data in the response')
//                 assert.equal(syncData[SCHEMA_POST].length, providerConfig.postLimit, `Correct number of posts received (${syncData[SCHEMA_POST].length} != ${providerConfig.postLimit})`)
//             } catch (err) {
//                 console.log(err)
//             }
//         })

//         it("Can fetch Following data", async () => {
//             const syncData = await provider.sync(creds.accessToken, creds.refreshToken, SCHEMA_FOLLOWING)

//             assert.ok(syncData, 'Have data returned')
//             assert.ok(SCHEMA_FOLLOWING in syncData, 'Have Following data in the response')
//             assert.equal(syncData[SCHEMA_FOLLOWING].length, providerConfig.followingLimit, `Correct number of following records received`)
//         })
//     })
// })