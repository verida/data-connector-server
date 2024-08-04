import { Command } from "command-line-interface";
import { ConnectionsOptions } from "./interfaces";
import { AutoAccount } from "@verida/account-node";
import { Network } from "@verida/types";
import { Utils } from "../../utils";
import { SchemaRecord } from "../../schemas";
import { COMMAND_PARAMS } from "../utils";
import SyncManager from "../../sync-manager";

export const Connections: Command<ConnectionsOptions> = {
  name: "Connections",
  description: `Show data for a given schema`,
  optionDefinitions: [
    COMMAND_PARAMS.key,
    COMMAND_PARAMS.network,
    {
        ...COMMAND_PARAMS.provider,
        isRequired: false
    },
    COMMAND_PARAMS.providerId,
    {
      name: "showConnections",
      description: "Show the full connection object (includes access and refresh tokens)",
      type: "boolean",
      defaultValue: false,
      alias: "s",
    },
  ],
  async handle({ options }) {
    console.log(`Fetching current connections`);

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
    const vault = networkInstance.context;

    const syncManager = new SyncManager(
      await networkInstance.account.did(),
      options.key
    );

    const providers = await syncManager.getProviders(
      options.provider,
      options.providerId
    );

    console.log(`Found ${providers.length} connections`)

    for (const provider of providers) {
        const connection = provider.getConnection()
        console.log(`Provider ${provider.getProviderName()} (${provider.getProviderId()})`)
        if (options.showConnections) {
          console.log(JSON.stringify(connection, null, 2))  
        } else {
          console.log(JSON.stringify(connection.profile, null, 2))
        }
    }

    console.log('-COMPLETE-')
    await vault.close();
  },
};

function printItems(items: SchemaRecord[], attributes: string[] = []) {
  for (let item of items) {
    console.log("-");
    if (attributes.length) {
      for (let att of attributes) {
        // @ts-ignore
        if (item[att]) {
          // @ts-ignore
          console.log(`${att}: ${item[att]}`);
        }
      }
    } else {
      console.log(item);
    }
  }
}
