const assert = require("assert")
import CONFIG from '../../src/config'
import { SyncHandlerStatus, SyncSchemaPosition, SyncSchemaPositionType, SyncStatus } from '../../src/interfaces'
import Providers from '../../src/providers'

import Post from '../../src/providers/faucet/post'
import { SchemaPost } from '../../src/schemas'

const SCHEMA_POST = CONFIG.verida.schemas.POST

const providerName = 'faucet'

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    describe("Fetch API data", () => {
        const provider = Providers(providerName)

        it("Can fetch Posts", async () => {
            const syncPosition: SyncSchemaPosition = {
                _id: `faucet-${SCHEMA_POST}`,
                type: SyncSchemaPositionType.SYNC,
                provider: 'faucet',
                schemaUri: SCHEMA_POST,
                status: SyncHandlerStatus.ACTIVE
            }

            const api = await provider.getApi('fake-access-token', 'fake-refresh-token')
            const postHandler = <Post> await provider.getSyncHandler(Post)
            postHandler.setConfig({
                limit: 3
            })

            // Snapshot: Page 1
            const response = await postHandler._sync(api, syncPosition)
            const results = <SchemaPost[]> response.results
            
            assert.ok(results && results.length, 'Have results returned')
            assert.ok(results && results.length == 3, 'Have correct number of results returned')
            assert.equal(results[0]._id, "1", 'First result has expected _id')
            assert.ok(results[0]._id < results[1]._id, 'First page of results are most recent first')

            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            assert.ok(response.position.thisRef, 'Have a next result reference')
            assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            assert.equal(results[0]._id.toString(), response.position.futureBreakId, 'Future break ID matches the first result ID')

            // Snapshot: Page 2
            const response2 = await postHandler._sync(api, syncPosition)
            const results2 = <SchemaPost[]> response2.results

            assert.ok(results2 && results2.length, 'Have second page of results returned')
            assert.ok(results2 && results2.length == 3, 'Have correct number of results returned in second page')
            assert.ok(results2[0]._id < results2[1]._id, 'Second page of results are most recent first')
            assert.ok(results2[0]._id > results[2]._id, 'First item on second page of results have earlier timestamp than last item on first page')
            
            assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            assert.ok(response.position.thisRef, 'Have a next page reference')
            assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            assert.equal(results[0]._id.toString(), response.position.futureBreakId, 'Future break ID matches the first result ID')


            // Update: Page 1 (ensure 1 result only)
            // Fetch the update set of results to confirm `position.pos` is correct
            // Make sure we fetch the first post only, by setting the break to the second item
            const position = response2.position
            position.thisRef = undefined
            position.breakId = results[1]._id
            position.futureBreakId = undefined

            const response3 = await postHandler._sync(api, position)
            const results3 = <SchemaPost[]> response3.results

            assert.equal(1, results3.length, '1 result returned')
            assert.equal(results3[0]._id, results[0]._id, 'Correct ID returned')

            assert.equal(response.position.status, SyncHandlerStatus.STOPPED, 'Sync is stopped')
            assert.equal(response.position.thisRef, undefined, 'No next result set reference')
            assert.equal(response.position.breakId, results3[0]._id.toString(), 'Break ID is the first result')
            assert.equal(response.position.futureBreakId, undefined, 'Future break ID is undefined')
        })
    })
})