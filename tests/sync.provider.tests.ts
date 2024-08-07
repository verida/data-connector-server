const assert = require("assert")

import CommonUtils from './common.utils'
import SyncManager from '../src/sync-manager'
import MockProvider from '../src/providers/mock/index'
import CONFIG from '../src/config'
import { IContext, IDatastore } from '@verida/types'
import { Connection, SyncHandlerStatus, SyncHandlerPosition, SyncSchemaPositionType, SyncStatus } from '../src/interfaces'
import { Utils } from '../src/utils'
import serverconfig from '../src/config'
import BaseProvider from '../src/providers/BaseProvider'

const SCHEMA_POST = CONFIG.verida.schemas.POST
const SCHEMA_SYNC_POSITIONS = CONFIG.verida.schemas.SYNC_POSITION
const SCHEMA_CONNECTIONS = CONFIG.verida.schemas.DATA_CONNECTIONS

const providerName = 'mock'
let syncPositionsDs: IDatastore
let postsDs: IDatastore
let connectionsDs: IDatastore
let vault: IContext
let api: any
// let postHandler: Post
// let syncPosition: SyncSchemaPosition
// let backfillPosition: SyncSchemaPosition
let provider: MockProvider

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    this.beforeAll(async function() {
        const networkInstance = await CommonUtils.getNetwork()
        vault = networkInstance.context

        syncPositionsDs = await vault.openDatastore(SCHEMA_SYNC_POSITIONS)
        postsDs = await vault.openDatastore(SCHEMA_POST)
        connectionsDs = await vault.openDatastore(SCHEMA_CONNECTIONS)
        const syncManager = new SyncManager(await networkInstance.account.did(), serverconfig.verida.testVeridaKey)

        // create mock connection
        await syncManager.saveProvider(providerName, 'fake-access-token', 'fake-refresh-token', {})
        const providers = await syncManager.getProviders(providerName)
        provider = <MockProvider> providers[0]
        provider.setConfig({
            label: 'Mock',
            sbtImage: '',
            limit: 3,
            maxSyncLoops: 5
        })

        api = await provider.getApi('fake-access-token', 'fake-refresh-token')
        // postHandler = <Post> await provider.getSyncHandler(Post)
        // postHandler.setConfig({
        //     limit: 3
        // })

        // syncPosition = {
        //     _id: Utils.buildSyncHandlerId(providerName, SCHEMA_POST, SyncSchemaPositionType.SYNC),
        //     type: SyncSchemaPositionType.SYNC,
        //     provider: providerName,
        //     schemaUri: SCHEMA_POST,
        //     status: SyncHandlerStatus.ACTIVE
        // }

        // backfillPosition = {
        //     _id: Utils.buildSyncHandlerId(providerName, SCHEMA_POST, SyncSchemaPositionType.BACKFILL),
        //     type: SyncSchemaPositionType.BACKFILL,
        //     provider: providerName,
        //     schemaUri: SCHEMA_POST,
        //     status: SyncHandlerStatus.ACTIVE
        // }

        // postHandler.on('error', (syncError: SyncProviderErrorEvent) => {
        //     console.log('Sync error:')
        //     console.log(syncError)
        // })
    })

    describe("Sync provider tests", () => {
        it(`Can complete a full sync using ${providerName}`, async () => {
            // start sync
            await provider.sync('', '')
            
            // verify connection is correct
            const connection = <Connection> await connectionsDs.get(providerName, {})
            assert.equal(SyncStatus.CONNECTED, connection.syncStatus, "Connection sync status is active")

            // verify sync position is correct
            const syncPosition = <SyncHandlerPosition> await syncPositionsDs.get(Utils.buildSyncHandlerId(providerName, provider.getProviderId(), 'post', SyncSchemaPositionType.SYNC), {})
            assert.equal(SyncHandlerStatus.STOPPED, syncPosition.status, 'Sync status is stopped')
            assert.equal('1', syncPosition.breakId, 'Sync break ID is correct')

            // verify backfill position is correct
            const backfillPosition = <SyncHandlerPosition> await syncPositionsDs.get(Utils.buildSyncHandlerId(providerName, provider.getProviderId(), 'post', SyncSchemaPositionType.BACKFILL), {})
            assert.equal(SyncHandlerStatus.STOPPED, backfillPosition.status, 'Backfill status is stopped')

            // verify results are correct
            const posts = await postsDs.getMany()
            assert.equal(10, posts.length, 'Correct number of results')
        })
    })

    this.afterAll(async function() {
        // Delete the connection for mock
        await connectionsDs.delete(providerName)
        // @todo: truncate connections?

        // Destroy created databases and close the vault
        const db11 = await syncPositionsDs.getDb()
        await db11.destroy()

        const db2 = await postsDs.getDb()
        await db2.destroy()
        await vault.close()
    })
})