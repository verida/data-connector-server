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

let connection, followingDatastore, encryptionKey, credential

// NEXT STEP: GET UPDATED TWITTER REFRESH AND ACCESS TOKEN


describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    describe("VC and SBT tests", () => {
        //let syncResult
        const provider = Providers(providerName)

        before(async () => {
            const provider = Providers(providerName)
            connection = await CommonUtils.getNetwork()
            // Open the "following" datastore
            followingDatastore = await connection.context.openDatastore(
                SCHEMA_FOLLOWING
            )

            const info = await (await followingDatastore.getDb()).info()
            encryptionKey = info.encryptionKey
            await CommonUtils.closeDatastore(followingDatastore)
        })

        it('can sync without obtaining a VC', async() => {
            // Todo: Make this use the server??
            const syncRequestResult = await CommonUtils.syncConnector(providerName, creds.accessToken, creds.refreshToken, connection.did, encryptionKey)

            console.log(syncRequestResult.data)
            try {
                const { serverDid, contextName, syncRequestId, syncRequestDatabaseName } = syncRequestResult.data
                const syncData = await provider.sync(creds.accessToken, creds.refreshToken, SCHEMA_FOLLOWING)
                console.log(syncData)
            } catch (err) {
                console.log(err)
            }
        })

        it('can sync and obtain a VC', async() => {

        })

        it('can generate a valid VC', async () => {

        })

        it('can generate a valid SBT', async () => {

        })

        after(async () => {
            // Delete SBT?
        })
    })
})