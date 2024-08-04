import { Command } from "command-line-interface";
import { SyncOptions } from "./interfaces";
import { AutoAccount } from "@verida/account-node";
import { Network } from "@verida/types";
import CONFIG from "../../config";

import serverconfig from "../../../src/serverconfig.json";
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
    {
      name: "provider",
      description: "Unique ID of the provider",
      type: "string",
      alias: "p",
      isRequired: true,
    },
    {
      name: "providerId",
      description: "Unique ID of the connection for this provider",
      type: "string",
      alias: "i",
      isRequired: false,
    },
    {
      name: "force",
      description: "Force sync to start",
      type: "boolean",
      defaultValue: false,
      alias: "f",
    },
    COMMAND_PARAMS.key,
    COMMAND_PARAMS.network,
  ],
  async handle({ options }) {
    if (!options.key) {
      console.log(`No key specified from command line or environment variable`);
      return;
    }

    // Initialize Account
    const account = new AutoAccount({
      privateKey: options.key,
      network: <Network>options.network,
      didClientConfig: {
        callType: "web3",
        web3Config: {
          // Set a dummy private key as we shouldn't need to create a DID automatically
          // The sending DID should already exist
          privateKey:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
      },
    });

    const did = (await account.did()).toLowerCase();
    console.log(
      `Syncing data from ${options.provider} to ${did} on network ${options.network}.`
    );

    const networkInstance = await Utils.getNetwork(did, options.key);
    const vault = networkInstance.context;
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
      await networkInstance.account.did(),
      options.key
    );

    const providers = await syncManager.getProviders(
      options.provider,
      options.providerId
    );
    const provider = providers[0];

    // console.log('Syncing started')
    const connection = provider.getConnection();
    await provider.sync(
      connection.accessToken,
      connection.refreshToken,
      options.force
    );
    // console.log('Syncing done')

    // Sleep for 5 seconds so sync can complete
    await sleep(5000);

    await logs.close();
    await vault.close();
    console.log("Ended");
  },
};
