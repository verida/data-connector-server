import { Command } from "command-line-interface";
import { SyncOptions } from "./interfaces";
import { AutoAccount } from "@verida/account-node";
import { Network } from "@verida/types";

import serverconfig from "../../config";
import { Utils } from "../../utils";
import SyncManager from "../../sync-manager";
import { SyncProviderLogEntry } from "../../interfaces";
import { COMMAND_PARAMS } from "../utils";

const SCHEMA_SYNC_LOG = serverconfig.verida.schemas.SYNC_LOG;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const Sync: Command<SyncOptions> = {
  name: "Sync",
  description: `Sync to a third party data provider and save the credentials into the Verida: Vault context`,
  optionDefinitions: [
    COMMAND_PARAMS.provider,
    COMMAND_PARAMS.providerId,
    COMMAND_PARAMS.key,
    COMMAND_PARAMS.network,
    {
      name: "force",
      description: "Force sync to start",
      type: "boolean",
      defaultValue: false,
      alias: "f",
    },
    {
      name: "syncToEnd",
      description: "Sync until there are no more items? If not, will stop after batch limit is hit.",
      type: "boolean",
      defaultValue: false,
      alias: "e",
    },
  ],
  async handle({ options }) {
    if (!options.key) {
      console.log(`No key specified from command line or environment variable`);
      return;
    }

    const networkConnection = await Utils.getNetworkConnectionFromPrivateKey(options.key);
    const did = (await networkConnection.account.did()).toLowerCase();

    console.log(
      `Syncing data from (${options.provider}) (${options.providerId ? options.providerId : 'all connections'}) to ${did} on network ${options.network}.`
    );

    const vault = networkConnection.context;
    const logs = await vault.openDatastore(SCHEMA_SYNC_LOG);
    logs.changes(async function (changeInfo: any) {
      const log = <SyncProviderLogEntry>await logs.get(changeInfo.id, {});
      console.log(
        `${log.level.toUpperCase()}: ${log.message} (${log.insertedAt})${
          log.schemaUri ? "-" + log.schemaUri : ""
        }`
      );
    }, {});

    const syncManager = new SyncManager(
      networkConnection.context
    );

    const providers = await syncManager.getProviders(
      options.provider,
      options.providerId
    );


    for (const provider of providers) {
      await provider.sync(
        undefined,
        undefined,
        options.force,
        options.syncToEnd
      )
    }

    // Sleep for 5 seconds so sync can complete
    await sleep(5000);

    console.log('-COMPLETE-')
    await logs.close();
    await vault.close();
    console.log("Ended");
  },
};
