import { Command } from "command-line-interface";
import { SyncOptions } from "./interfaces";
import { AutoAccount } from "@verida/account-node";
import { Network } from "@verida/types";
import CONFIG from "../../config";

import serverconfig from "../../../src/serverconfig.json";
import { Utils } from "../../utils";
import SyncManager from "../../sync-manager";
import { SyncProviderLogEntry } from "../../interfaces";

const SCHEMA_SYNC_LOG = serverconfig.verida.schemas.SYNC_LOG

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
      name: "key",
      description: "Verida network private key (or seed phrase)",
      type: "string",
      defaultValue: CONFIG.verida.testVeridaKey,
      alias: "k",
    },
    {
      name: "network",
      description: "Verida network (banksia, myrtle)",
      type: "string",
      alias: "n",
      defaultValue: "mainnet",
      validate(val: string) {
        const valid = ["banksia", "myrtle"];
        if (valid.indexOf(val) === -1) {
          return false;
        }
      },
    },
  ],
  async handle({ options }) {
    console.log(
      `Connecting to ${options.provider} on network ${options.network}.`
    );

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
    console.log(`Verida Account has DID: ${did}`);

    const networkInstance = await Utils.getNetwork(did, options.key);
    const vault = networkInstance.context
    const logs = await vault.openDatastore(SCHEMA_SYNC_LOG)
    logs.changes(function(log: SyncProviderLogEntry) {
        console.log(`${log.level.toUpperCase()}: ${log.message} (${log.insertedAt})`)
    }, {})


    const syncManager = new SyncManager(
      await networkInstance.account.did(),
      serverconfig.verida.testVeridaKey
    )

    /////

    const providers = await syncManager.getProviders(options.provider)
    const provider = providers[0]

    console.log('Syncing started')
    const connection = provider.getConnection()
    await provider.sync(connection.accessToken, connection.refreshToken)
    //await syncManager.sync(options.provider)
    console.log('Syncing done')

    await logs.close()
    await vault.close()
  },
};
