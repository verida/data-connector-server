const assert = require("assert")
import { IContext, IDatastore } from '@verida/types'
import CONFIG from '../src/config'
import { SyncHandlerStatus, SyncProviderErrorEvent, SyncSchemaPosition, SyncSchemaPositionType, SyncStatus } from '../src/interfaces'
import Providers from '../src/providers'

import Post from '../src/providers/faucet/post'
import { SchemaPost } from '../src/schemas'
import CommonUtils from './common.utils'
import { Utils } from '../src/utils'

const SCHEMA_POST = CONFIG.verida.schemas.POST
const SCHEMA_SYNC_POSITIONS = CONFIG.verida.schemas.SYNC_POSITION

const providerName = 'faucet'

let syncPositionsDs: IDatastore
let postsDs: IDatastore
let vault: IContext
let api: any
let postHandler: Post
let syncPosition: SyncSchemaPosition
let backfillPosition: SyncSchemaPosition

describe(`Sync Handler Tests`, function() {
    this.timeout(100000)

    describe("Sync using the test Faucet provider", () => {
        const provider = Providers(providerName)

        this.beforeAll(async function() {
            const networkInstance = await CommonUtils.getNetwork()
            vault = networkInstance.context

            syncPositionsDs = await vault.openDatastore(SCHEMA_SYNC_POSITIONS)
            postsDs = await vault.openDatastore(SCHEMA_POST)

            api = await provider.getApi('fake-access-token', 'fake-refresh-token')
            postHandler = <Post> await provider.getSyncHandler(Post)
            postHandler.setConfig({
                limit: 3
            })

            syncPosition = {
                _id: Utils.buildSyncHandlerId('faucet', SCHEMA_POST, SyncSchemaPositionType.SYNC),
                type: SyncSchemaPositionType.SYNC,
                provider: 'faucet',
                schemaUri: SCHEMA_POST,
                status: SyncHandlerStatus.ACTIVE
            }

            backfillPosition = {
                _id: Utils.buildSyncHandlerId('faucet', SCHEMA_POST, SyncSchemaPositionType.BACKFILL),
                type: SyncSchemaPositionType.BACKFILL,
                provider: 'faucet',
                schemaUri: SCHEMA_POST,
                status: SyncHandlerStatus.ACTIVE
            }

            postHandler.on('error', (syncError: SyncProviderErrorEvent) => {
                console.log('Sync error:')
                console.log(syncError)
            })
        })

        it("Can sync page 1 of Posts", async () => {
            // Sync the first page of results
            await postHandler.sync(api, syncPosition, backfillPosition, syncPositionsDs, postsDs)

            // Verify sync position is correct
            const syncPos = await syncPositionsDs.get(`faucet:${SCHEMA_POST}:sync`, {})
            assert.ok(syncPos, 'Have a sync position record')
            assert.equal(syncPos.status, SyncHandlerStatus.ACTIVE, 'Sync status is active')
            assert.equal(syncPos.thisRef, "3", 'Sync status has correct position reference')
            assert.equal(syncPos.futureBreakId, "1", 'Sync status has correct future break ID')

            // Verify backfill position is correct

            // Verify posts are correct
            const posts = <SchemaPost[]> await postsDs.getMany()
            assert.equal(posts.length, 3, 'Have 3 posts in the datastore')
            assert.equal(posts[0]['_id'], "1", 'Have correct first item ID for page 1')
            assert.equal(posts[2]['_id'], "3", 'Have correct first item ID for page 1')
            assert.ok(posts[0].modifiedAt, 'Posts have a modified timestamp')
            assert.ok(posts[0].insertedAt, 'Posts have a inserted timestamp')
        })

        it("Can sync page 2 of Posts", async () => {
            // Sync the second page of results
            await postHandler.sync(api, syncPosition, backfillPosition, syncPositionsDs, postsDs)

            // Verify sync position is correct
            const syncPos = await syncPositionsDs.get(`faucet:${SCHEMA_POST}:sync`, {})
            assert.ok(syncPos, 'Have a sync position record')
            assert.equal(syncPos.status, SyncHandlerStatus.ACTIVE, 'Sync status is active')
            assert.equal(syncPos.thisRef, "6", 'Sync status has correct position reference')
            assert.equal(syncPos.futureBreakId, "1", 'Sync status has correct future break ID')

            // Verify backfill position is correct

            // Verify posts are correct
            const posts = await postsDs.getMany()
            assert.equal(6, posts.length, 'Have 6 posts in the datastore')
            assert.equal(posts[3]['_id'], "4", 'Have correct first item ID for page 2')
            assert.equal(posts[5]['_id'], "6", 'Have correct last item ID for page 2')
        })

        it("Can sync page 3 of Posts", async () => {
            // Sync the second page of results
            await postHandler.sync(api, syncPosition, backfillPosition, syncPositionsDs, postsDs)

            // Verify sync position is correct
            const syncPos = await syncPositionsDs.get(`faucet:${SCHEMA_POST}:sync`, {})
            assert.ok(syncPos, 'Have a sync position record')
            assert.equal(SyncHandlerStatus.ACTIVE, syncPos.status, 'Sync status is active')
            assert.equal("9", syncPos.thisRef, 'Sync status has correct position reference')
            assert.equal("1", syncPos.futureBreakId, 'Sync status has correct future break ID')

            // Verify backfill position is correct

            // Verify posts are correct
            const posts = await postsDs.getMany()
            assert.equal(9, posts.length, 'Have 9 posts in the datastore')
            assert.equal(posts[6]['_id'], "7", 'Have correct first item ID for page 3')
            assert.equal(posts[8]['_id'], "9", 'Have correct last item ID for page 3')
        })

        it("Can sync last page of Posts", async () => {
            // Sync the second page of results
            await postHandler.sync(api, syncPosition, backfillPosition, syncPositionsDs, postsDs)

            // Verify sync position is correct
            const syncPos = await syncPositionsDs.get(`faucet:${SCHEMA_POST}:sync`, {})
            assert.ok(syncPos, 'Have a sync position record')
            assert.equal(syncPos.status, SyncHandlerStatus.STOPPED, 'Sync status is stopped')
            assert.equal(syncPos.thisRef, undefined, 'Sync status has correct position reference')
            assert.equal(syncPos.futureBreakId, undefined, 'Sync status has undefined future break ID')
            assert.equal("1", syncPos.breakId, 'Sync status has correct break ID')

            // Verify backfill position is correct

            // Verify posts are correct
            const posts = await postsDs.getMany({}, {
                // Sort database results by most recent first
                sort: [{'insertedAt': 'asc'}]
            })
            assert.equal(10, posts.length, 'Have 10 posts in the datastore')
            assert.equal("10", posts[9]['_id'], 'Have correct last item ID for last page of results')
        })

        this.afterAll(async function() {
            // Destroy created databases and close the vault
            const db11 = await syncPositionsDs.getDb()
            await db11.destroy()

            const db2 = await postsDs.getDb()
            await db2.destroy()
            await vault.close()
        })
    })
})