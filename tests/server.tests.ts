import Axios from 'axios'
const assert = require("assert")
import serverconfig from '../src/serverconfig.json'
import Providers from '../src/providers'
import CommonUtils from './common.utils'

const SCHEMA_FOLLOWING = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = serverconfig.logLevel

const providerName = 'twitter'
const providerConfig = serverconfig.providers[providerName]
const creds = providerConfig.testing

let connection, followingDatastore, encryptionKey

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    describe("Server tests", () => {
        //let syncResult
        const provider = Providers(providerName)

        before(async () => {
            // Connect to the Verida network with a fake Vault context
            connection = await CommonUtils.getNetwork()

            // Open the "following" datastore
            followingDatastore = await connection.context.openDatastore(
                SCHEMA_FOLLOWING
            )

            const info = await (await followingDatastore.getDb()).info()
            encryptionKey = info.encryptionKey
            //console.log(info)
            await CommonUtils.closeDatastore(followingDatastore)
        })

        it(`Can sync ${providerName}`, async () => {
            const syncRequestResult = await CommonUtils.syncConnector(providerName, creds.accessToken, creds.refreshToken, connection.did, encryptionKey)

            console.log(syncRequestResult.data)

            const { serverDid, contextName, syncRequestId, syncRequestDatabaseName } = syncRequestResult.data

            /*this.checkSync(
                serverDid,
                contextName,
                syncRequestId,
                syncRequestDatabaseName
            )

            const syncData = await provider.sync(creds.accessToken, creds.refreshToken, SCHEMA_FOLLOWING)

            assert.ok(syncData, 'Have data returned')
            assert.ok(SCHEMA_POST in syncData, 'Have Post data in the response')
            assert.equal(syncData[SCHEMA_POST].length, providerConfig.postLimit, `Correct number of posts received`)*/
        })

        after(async () => {
            await connection.context.close({
                clearLocal: true
            })
        })
    })
})