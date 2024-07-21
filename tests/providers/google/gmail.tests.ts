const assert = require("assert")
import CONFIG from '../../../src/config'
import { Connection, SyncHandlerStatus, SyncSchemaPosition, SyncSchemaPositionType, SyncStatus } from '../../../src/interfaces'
import Providers from '../../../src/providers'
import CommonUtils, { NetworkInstance } from '../../common.utils'

import Gmail from '../../../src/providers/google/gmail'
import { SchemaEmail } from '../../../src/schemas'
import serverconfig from '../../../src/serverconfig.json'
import BaseProvider from '../../../src/providers/BaseProvider'

const SCHEMA_EMAIL = CONFIG.verida.schemas.EMAIL

const providerName = 'google'
let network: NetworkInstance
let connection: Connection
let provider: BaseProvider

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    this.beforeAll(async function() {
        network = await CommonUtils.getNetwork()
        connection = await CommonUtils.getConnection(providerName)
        provider = Providers(providerName, network.context, connection)
    })

    describe("Fetch API data", () => {

        it("Can fetch Emails", async () => {
            const syncPosition: SyncSchemaPosition = {
                _id: `${providerName}-${SCHEMA_EMAIL}`,
                type: SyncSchemaPositionType.SYNC,
                provider: providerName,
                schemaUri: SCHEMA_EMAIL,
                status: SyncHandlerStatus.ACTIVE
            }

            // const api = await provider.getApi(connection.accessToken, connection.refreshToken)
            const handler = <Gmail> await provider.getSyncHandler(Gmail)
            handler.setConfig({
                ...serverconfig.providers.google,
                batchSize: 3
            })

            const api = await provider.getApi(connection.accessToken, connection.refreshToken)

            // Snapshot: Page 1
            const response = await handler._sync(api, syncPosition)
            console.log(response.results[1])

            // const results = <SchemaEmail[]> response.results
            
            // assert.ok(results && results.length, 'Have results returned')
            // assert.ok(results && results.length == 3, 'Have correct number of results returned')
            // assert.ok(results[0].sentAt > results[1].sentAt, 'Results are most recent first')
            // console.log(results[0]._id, response.position)

            // assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            // assert.ok(response.position.thisRef, 'Have a next page reference')
            // assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            // assert.equal(results[0]._id, `google-${response.position.futureBreakId}`, 'Future break ID matches the first result ID')

            // // Snapshot: Page 2
            // const response2 = await postHandler._sync(api, syncPosition)
            // const results2 = <SchemaPost[]> response2.results

            // assert.ok(results2 && results2.length, 'Have second page of results returned')
            // assert.ok(results2 && results2.length == 3, 'Have correct number of results returned in second page')
            // assert.ok(results2[0].insertedAt > results2[1].insertedAt, 'Results are most recent first')
            // assert.ok(results2[0].insertedAt < results[2].insertedAt, 'First item on second page of results have earlier timestamp than last item on first page')
            
            // assert.equal(response.position.status, SyncStatus.ACTIVE, 'Sync is still active')
            // assert.ok(response.position.thisRef, 'Have a next page reference')
            // assert.equal(PostSyncRefTypes.Url, response.position.thisRefType, 'This position reference type is URL fetch')
            // assert.equal(response.position.breakId, undefined, 'Break ID is undefined')
            // assert.equal(results[0]._id, `facebook-${response.position.futureBreakId}`, 'Future break ID matches the first result ID')


            // // Update: Page 1 (ensure 1 result only)
            // // Fetch the update set of results to confirm `position.pos` is correct
            // // Make sure we fetch the first post only, by setting the break to the second item
            // const position = response2.position
            // position.thisRef = undefined
            // position.thisRefType = PostSyncRefTypes.Api
            // position.breakId = results[1]._id.replace('facebook-', '')
            // position.futureBreakId = undefined

            // const response3 = await postHandler._sync(api, position)
            // const results3 = <SchemaPost[]> response3.results
            // assert.equal(results3.length, 1, '1 result returned')
            // assert.equal(results3[0]._id, results[0]._id, 'Correct ID returned')

            // assert.equal(response.position.status, SyncHandlerStatus.STOPPED, 'Sync is stopped')
            // assert.equal(response.position.thisRef, undefined, 'No next page reference')
            // assert.equal(PostSyncRefTypes.Api, response.position.thisRefType, 'This position reference type is API fetch')
            // assert.equal(response.position.breakId, results3[0]._id.replace('facebook-', ''), 'Break ID is the first result')
            // assert.equal(response.position.futureBreakId, undefined, 'Future break ID is undefined')
        })
    })

    this.afterAll(async function() {
        const { context } = await CommonUtils.getNetwork()
        await context.close()
    })
})