const assert = require("assert")
import CommonUtils from "./common.utils"

const SCHEMA_LIKES = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

// token must be manually fetched for now
// the account linked to this token must have
//  - At least 5 page likes
const accessToken = ''
const refreshToken = ''

const provider = 'twitter'

describe(`${provider} Tests`, function() {
    this.timeout(100000)
    const nonce = '1'
    let connection

    describe("Sync", () => {
        let syncResult

        it("Can sync", async () => {
            connection = await CommonUtils.getNetwork()
            syncResult = await CommonUtils.syncConnector(provider, accessToken, refreshToken, connection.did, nonce)

            assert.ok(syncResult, 'Have a sync result')
            assert.ok(syncResult.data, 'Have sync result data')
            assert.equal(syncResult.data.did, connection.did, 'Expected DID returned')
            assert.equal(syncResult.data.contextName, 'Verida: Data Connector', 'Have expected context name')
        })

        it("Has valid following", async () => {
            const { response, signerDid, contextName } = syncResult.data
            assert.ok(response[SCHEMA_LIKES], 'Have valid response data')

            const { databaseName, encryptionKey } = response[SCHEMA_LIKES]

            const externalDatastore = await CommonUtils.openSchema(connection.context, contextName, SCHEMA_LIKES, databaseName, encryptionKey, signerDid, connection.did)

            const results = await externalDatastore.getMany()
            assert.equal(results.length >= 5, true, 'Have expected number of results')
            const db = await externalDatastore.getDb()
            await db._localDb.destroy()
        })
    })
})