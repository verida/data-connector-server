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
            encryptionKey = Buffer.from(info.encryptionKey).toString('hex')
            await CommonUtils.closeDatastore(followingDatastore)
        })

        it(`Can sync ${providerName}`, async () => {
            const syncSchemas = {}
            syncSchemas[SCHEMA_FOLLOWING] = {
                limit: 10
            }
            const syncRequestResult = await CommonUtils.syncConnector(providerName, creds.accessToken, creds.refreshToken, connection.did, encryptionKey, syncSchemas)

            const syncResult = await CommonUtils.getSyncResult(connection, syncRequestResult, encryptionKey)
            const schemaResult = syncResult.syncInfo.schemas[SCHEMA_FOLLOWING]

            const followingDatastore = await CommonUtils.openSchema(
                connection.context,
                syncRequestResult.data.contextName,
                SCHEMA_FOLLOWING,
                schemaResult.databaseName,
                schemaResult.encryptionKey,
                syncRequestResult.data.serverDid,
                syncRequestResult.data.did
            )
            
            // Get all the data that was fetched
            const syncData = await followingDatastore.getMany()

            // Close the database
            await CommonUtils.closeDatastore(followingDatastore)

            // Confirm we have the expected data
            assert.ok(syncData, 'Have data returned')
            assert.equal(syncData.length, syncSchemas[SCHEMA_FOLLOWING].limit, 'Have correct number of items returned')

            // Cleanup by having the server delete it's database of data
            await CommonUtils.syncDone(providerName, connection.did)
        })

        // confirm sync since last works for a given schema

        // confirm sync all works?

        after(async () => {
            await connection.context.close({
                clearLocal: true
            })
        })
    })
})