const assert = require("assert")
import Providers from '../src/providers'
import CommonUtils from './common.utils'
import SyncManager from '../src/sync-manager'
import serverconfig from '../src/serverconfig.json'
import { IContext } from '@verida/types'

const providerName = 'faucet'
let syncManager: SyncManager, did: string, context: IContext

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    this.beforeAll(async function() {
        const veridaNetwork = await CommonUtils.getNetwork()
        did = veridaNetwork.did
        context = veridaNetwork.context

        syncManager = new SyncManager(did, serverconfig.verida.testVeridaKey)
    })

    describe("Sync Manager tests", () => {

        it(`Can sync using ${providerName}`, async () => {
            // open and reset faucet connection
            // delete faucet posts
            // sync using sync manager
            await syncManager.sync(providerName)
            // verify sync has worked as expected
        })

        after(async () => {
            await context.close({
                clearLocal: true
            })
        })
    })
})