import { NetworkConnection } from "../utils"
import CONFIG from "../config"
import SyncManager from "../sync-manager"

// How often to initiate sync
// Note: Sync won't necessarily run, ie: if it's already running, nothing will happen or 
// if the sync frequency means it shouldn't run, then it won't run
const SYNC_INTERVAL = <number> CONFIG.verida.backgroundSync.intervalMins
const SYNC_ENABLED = <boolean> CONFIG.verida.backgroundSync.enabled

interface BackgroundSyncRecord {
    networkConnection: NetworkConnection
    nextSync: number
}

export class BackgroundSync {

    private syncAccounts: Record<string, BackgroundSyncRecord> = {}

    public start() {
        if (!SYNC_ENABLED) {
            return
        }

        const instance = this
        setTimeout(() => {
            instance.doPendingSyncs()
        }, 1000*60)
    }

    public addAccount(networkConnection: NetworkConnection) {
        if (!SYNC_ENABLED) {
            return
        }

        const { did } = networkConnection
        // console.log(`addAccount(${did})`)

        const nowEpoch = new Date().getTime() / 1000.0

        if (!this.syncAccounts[did]) {
            this.syncAccounts[did] = {
                networkConnection,
                nextSync: nowEpoch + SYNC_INTERVAL * 60
            }
        }
    }

    public removeAccount(did: string) {
        // console.log(`removeAccount(${did})`)
        if (this.syncAccounts[did]) {
            delete this.syncAccounts[did]
        }
    }

    protected doPendingSyncs() {
        // console.log(`doPendingSyncs()`)
        const nowEpoch = new Date().getTime() / 1000.0

        // Loop through all sync accounts and sync those that need it
        for (const did in this.syncAccounts) {
            const account = this.syncAccounts[did]
            if (account.nextSync > nowEpoch) {
                // Don't await, as we do these in parallel
                this.doSync(did)
            }
        }
    }

    protected async doSync(did: string): Promise<void> {
        // console.log(`doSync(${did})`)
        if (this.syncAccounts[did]) {
            // Perform sync, sync manager will ensure multiple sync's don't happen at once for the same account
            const syncManager = new SyncManager(this.syncAccounts[did].networkConnection.context)
            await syncManager.sync(undefined, undefined, false, true)

            // Set next sync timestamp
            const nowEpoch = new Date().getTime() / 1000.0
            this.syncAccounts[did].nextSync = nowEpoch + SYNC_INTERVAL * 60
        }
    }

}

export const BackgroundSyncManager = new BackgroundSync