const assert = require("assert")
import CONFIG from '../../src/config'
import { SyncHandlerMode, SyncSchemaPosition, SyncStatus } from '../../src/interfaces'
import Providers from '../../src/providers'
import CommonUtils from '../common.utils'

import Following from '../../src/providers/facebook/following'
import Post from '../../src/providers/facebook/post'
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

        /*it.skip("check revision deletion", async() => {
            const { context } = await CommonUtils.getNetwork()
            const ds = await context.openDatastore('https://vault.schemas.verida.io/data-connections/connection/v0.2.0/schema.json')
            //const rows = await ds.getMany()
            //console.log(rows)
        })*/

        it("Can fetch Posts via snapshot and update", async () => {
            const connection = await CommonUtils.getConnection(providerName)

            const syncPosition: SyncSchemaPosition = {
                _id: `facebook-${SCHEMA_POST}`,
                provider: 'facebook',
                schemaUri: SCHEMA_POST,
                mode: SyncHandlerMode.SNAPSHOT,
                status: SyncStatus.ACTIVE
            }

            const api = await provider.getApi(connection.accessToken, connection.refreshToken)
            const postHandler = <Post> await provider.getSyncHandler(Post)
            postHandler.setConfig({
                postLimit: 3
            })

            // Snapshot: Page 1
            const response = await postHandler.syncSnapshot(api, syncPosition)
            const results = <SchemaPost[]> response.results
            
            assert.ok(results && results.length, 'Have results returned')
            assert.ok(results && results.length == 3, 'Have correct number of results returned')
            assert.ok(results[0].insertedAt > results[1].insertedAt, 'Results are most recent first')
            console.log(results[0]._id, response.position)
            assert.equal(results[0]._id, `facebook-${response.position.id}`, 'Position ID matches the first result ID')
            assert.equal(response.position.pos, undefined, 'Position post is undefined')

            assert.equal(response.position.mode, SyncHandlerMode.SNAPSHOT, 'Still in snapshot mode')
            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Still in snapshot mode')
            assert.ok(response.position.next, 'Have a second page of results')

            // Snapshot: Page 2
            const response2 = await postHandler.syncSnapshot(api, syncPosition)
            const results2 = <SchemaPost[]> response2.results

            assert.ok(results2 && results2.length, 'Have second page of results returned')
            assert.ok(results2 && results2.length == 3, 'Have correct number of results returned in second page')
            assert.ok(results2[0].insertedAt > results2[1].insertedAt, 'Results are most recent first')
            assert.ok(results2[0].insertedAt < results[2].insertedAt, 'First item on second page of results have earlier timestamp than last item on first page')
            assert.equal(results[0]._id, `facebook-${response.position.id}`, 'Position ID still matches the first result ID')
            assert.equal(response2.position.pos, undefined, 'Position post is undefined')

            // Update: Page 1 (ensure 1 result only)
            console.log(`-- Fetch update`)
            // Fetch the update set of results to confirm `position.pos` is correct
            const position = response2.position
            position.mode = SyncHandlerMode.UPDATE
            position.next = undefined
            // Make sure we fetch the first post only
            position.id = results[1]._id

            const response3 = await postHandler.syncUpdate(api, position)
            const results3 = <SchemaPost[]> response3.results
            assert.equal(results3.length, 1, '1 result returned')
            assert.equal(results3[0]._id, results[0]._id, 'Correct ID returned')
            assert.equal(response3.position.next, undefined, 'Next page is undefined')

            /*position.pos = undefined
            const response4 = await postHandler.syncUpdate(api, position)
            const results4 = <SchemaFollowing[]> response4.results

            assert.equal(results[0]._id, results4[0]._id, 'First results match')*/
        })

        it.skip("Can fetch Following via snapshot and update", async () => {
            const connection = await CommonUtils.getConnection(providerName)

            const syncPosition: SyncSchemaPosition = {
                _id: `facebook-${SCHEMA_FOLLOWING}`,
                provider: 'facebook',
                schemaUri: SCHEMA_FOLLOWING,
                mode: SyncHandlerMode.SNAPSHOT,
                status: SyncStatus.ACTIVE
            }

            const api = await provider.getApi(connection.accessToken, connection.refreshToken)
            const followingHandler = <Following> await provider.getSyncHandler(Following)
            followingHandler.setConfig({
                followingLimit: 3
            })


            const response = await followingHandler.syncSnapshot(api, syncPosition)
            const results = <SchemaFollowing[]> response.results
            
            assert.ok(results && results.length, 'Have results returned')
            assert.ok(results && results.length == 3, 'Have correct number of results returned')
            assert.ok(results[0].insertedAt > results[1].insertedAt, 'Results are most recent first')

            assert.equal(response.position.mode, SyncHandlerMode.SNAPSHOT, 'Still in snapshot mode')
            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Still in snapshot mode')
            assert.ok(response.position.next, 'Have a second page of results')

            // Fetch the next page of results
            const response2 = await followingHandler.syncSnapshot(api, syncPosition)
            const results2 = <SchemaFollowing[]> response2.results

            assert.ok(results2 && results2.length, 'Have results returned')
            assert.ok(results2 && results2.length == 3, 'Have correct number of results returned')
            assert.ok(results2[0].insertedAt > results2[1].insertedAt, 'Results are most recent first')

            assert.ok(results2[0].insertedAt < results[2].insertedAt, 'First item on second page of results have earlier timestamp than last item on first page')

            // Fetch the update set of results to confirm `position.pos` is correct
            const position = response2.position
            position.mode = SyncHandlerMode.UPDATE

            const response3 = await followingHandler.syncUpdate(api, position)
            assert.equal(response3.results.length, 0, 'No new results')

            position.pos = undefined
            const response4 = await followingHandler.syncUpdate(api, position)
            const results4 = <SchemaFollowing[]> response4.results

            assert.equal(results[0]._id, results4[0]._id, 'First results match')
        })

        it.skip("Can fetch all Following via snapshot", async () => {
            const connection = await CommonUtils.getConnection(providerName)

            let syncPosition: SyncSchemaPosition = {
                _id: `facebook-${SCHEMA_FOLLOWING}`,
                provider: 'facebook',
                schemaUri: SCHEMA_FOLLOWING,
                mode: SyncHandlerMode.SNAPSHOT,
                status: SyncStatus.ACTIVE
            }

            const api = await provider.getApi(connection.accessToken, connection.refreshToken)
            const followingHandler = <Following> await provider.getSyncHandler(Following)
            followingHandler.setConfig({
                followingLimit: 100
            })

            let results: SchemaFollowing[] = []
            while (true) {
                const response = await followingHandler.syncSnapshot(api, syncPosition)
                syncPosition = response.position

                if (response.results.length == 0 || response.position.status == SyncStatus.STOPPED) {
                    break
                }

                results = results.concat(<SchemaFollowing[]> response.results)
            }

            console.log(`Found ${results.length} records`)
            console.log(results[0])
        })
    })

    this.afterAll(async function() {
        const { context } = await CommonUtils.getNetwork()
        await context.close()
    })
})