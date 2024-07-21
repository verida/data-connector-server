const assert = require("assert")
import CONFIG from '../../src/config'
import { SyncHandlerStatus, SyncSchemaPosition, SyncSchemaPositionType, SyncStatus } from '../../src/interfaces'
import Providers from '../../src/providers'
import CommonUtils from '../common.utils'

import Following from '../../src/providers/facebook/following'
import Post, { PostSyncRefTypes } from '../../src/providers/facebook/post'
import { SchemaFollowing, SchemaPost } from '../../src/schemas'

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

        it.skip("Can fetch Posts", async () => {
            const connection = await CommonUtils.getConnection(providerName)

            const syncPosition: SyncSchemaPosition = {
                _id: `facebook-${SCHEMA_POST}`,
                type: SyncSchemaPositionType.SYNC,
                provider: 'facebook',
                schemaUri: SCHEMA_POST,
                status: SyncHandlerStatus.ACTIVE
            }

            const api = await provider.getApi(connection.accessToken, connection.refreshToken)
            const postHandler = <Post> await provider.getSyncHandler(Post)
            postHandler.setConfig({
                postBatchSize: 3
            })

            // Snapshot: Page 1
            const response = await postHandler._sync(api, syncPosition)
            const results = <SchemaPost[]> response.results
            
            assert.ok(results && results.length, 'Have results returned')
            assert.ok(results && results.length == 3, 'Have correct number of results returned')
            assert.ok(results[0].insertedAt > results[1].insertedAt, 'Results are most recent first')

            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            assert.ok(response.position.thisRef, 'Have a next page reference')
            assert.equal(PostSyncRefTypes.Url, response.position.thisRefType, 'This position reference type is URL fetch')
            assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            assert.equal(results[0]._id, `facebook-${response.position.futureBreakId}`, 'Future break ID matches the first result ID')

            // Snapshot: Page 2
            const response2 = await postHandler._sync(api, syncPosition)
            const results2 = <SchemaPost[]> response2.results

            assert.ok(results2 && results2.length, 'Have second page of results returned')
            assert.ok(results2 && results2.length == 3, 'Have correct number of results returned in second page')
            assert.ok(results2[0].insertedAt > results2[1].insertedAt, 'Results are most recent first')
            assert.ok(results2[0].insertedAt < results[2].insertedAt, 'First item on second page of results have earlier timestamp than last item on first page')
            
            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            assert.ok(response.position.thisRef, 'Have a next page reference')
            assert.equal(PostSyncRefTypes.Url, response.position.thisRefType, 'This position reference type is URL fetch')
            assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            assert.equal(results[0]._id, `facebook-${response.position.futureBreakId}`, 'Future break ID matches the first result ID')


            // Update: Page 1 (ensure 1 result only)
            // Fetch the update set of results to confirm `position.pos` is correct
            // Make sure we fetch the first post only, by setting the break to the second item
            const position = response2.position
            position.thisRef = undefined
            position.thisRefType = PostSyncRefTypes.Api
            position.breakId = results[1]._id.replace('facebook-', '')
            position.futureBreakId = undefined

            const response3 = await postHandler._sync(api, position)
            const results3 = <SchemaPost[]> response3.results
            assert.equal(results3.length, 1, '1 result returned')
            assert.equal(results3[0]._id, results[0]._id, 'Correct ID returned')

            assert.equal(response.position.status, SyncHandlerStatus.STOPPED, 'Sync is stopped')
            assert.equal(response.position.thisRef, undefined, 'No next page reference')
            assert.equal(PostSyncRefTypes.Api, response.position.thisRefType, 'This position reference type is API fetch')
            assert.equal(response.position.breakId, results3[0]._id.replace('facebook-', ''), 'Break ID is the first result')
            assert.equal(response.position.futureBreakId, undefined, 'Future break ID is undefined')
        })

        it.skip("Can fetch Following", async () => {
            const connection = await CommonUtils.getConnection(providerName)

            const syncPosition: SyncSchemaPosition = {
                _id: `facebook-${SCHEMA_FOLLOWING}`,
                type: SyncSchemaPositionType.SYNC,
                provider: 'facebook',
                schemaUri: SCHEMA_FOLLOWING,
                status: SyncHandlerStatus.ACTIVE
            }

            const api = await provider.getApi(connection.accessToken, connection.refreshToken)
            const followHandler = <Following> await provider.getSyncHandler(Following)
            followHandler.setConfig({
                followingBatchSize: 3
            })

            // Page 1
            const response = await followHandler._sync(api, syncPosition)
            const results = <SchemaFollowing[]> response.results
            
            assert.ok(results && results.length, 'Have results returned')
            assert.ok(results && results.length == 3, 'Have correct number of results returned')
            assert.ok(results[0].insertedAt > results[1].insertedAt, 'Results are most recent first')

            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            assert.ok(response.position.thisRef, 'Have a next page reference')
            assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            assert.ok(response.position.futureBreakId, 'Future break ID is defined')

            // Page 2
            const response2 = await followHandler._sync(api, syncPosition)
            const results2 = <SchemaFollowing[]> response2.results

            assert.ok(results2 && results2.length, 'Have second page of results returned')
            assert.ok(results2 && results2.length == 3, 'Have correct number of results returned in second page')
            assert.ok(results2[0].insertedAt > results2[1].insertedAt, 'Results are most recent first')
            assert.ok(results2[0].insertedAt < results[2].insertedAt, 'First item on second page of results have earlier timestamp than last item on first page')
            
            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            assert.ok(response.position.thisRef, 'Have a next page reference')
            assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            assert.ok(response.position.futureBreakId, 'Future break ID is defined')

            // Page 1 (ensure 1 result only)
            // Fetch the update set of results to confirm `position.pos` is correct
            // Make sure we fetch the first post only, by setting the break to the second item
            const position = response2.position
            position.thisRef = undefined
            position.breakId = results[1]._id.replace('facebook-', '')
            position.futureBreakId = undefined

            const response3 = await followHandler._sync(api, position)
            const results3 = <SchemaFollowing[]> response3.results
            assert.equal(results3.length, 1, '1 result returned')
            assert.equal(results3[0]._id, results[0]._id, 'Correct ID returned')

            assert.equal(response.position.status, SyncHandlerStatus.STOPPED, 'Sync is stopped')
            assert.equal(response.position.thisRef, undefined, 'No next page reference')
            assert.equal(response.position.breakId, results3[0]._id.replace('facebook-', ''), 'Break ID is the first result')
            assert.equal(response.position.futureBreakId, undefined, 'Future break ID is undefined')
        })

        // @todo: backfill page description
    })

    this.afterAll(async function() {
        const { context } = await CommonUtils.getNetwork()
        await context.close()
    })
})