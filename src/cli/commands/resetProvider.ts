import { Command } from "command-line-interface";
import { ResetProviderOptions } from "./interfaces";
import { AutoAccount } from "@verida/account-node";
import { Network } from "@verida/types";
import CONFIG from "../../config";
import { Utils } from "../../utils";
import SyncManager from "../../sync-manager";
import serverconfig from "../../../src/serverconfig.json";

export const ResetProvider: Command<ResetProviderOptions> = {
  name: "ResetProvider",
  description: `Clear all the data and reset sync positions for a provider`,
  optionDefinitions: [
    {
      name: "provider",
      description: "Provider name",
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
        name: "clearTokens",
        description: "Clear access and refresh tokens",
        type: "boolean",
        defaultValue: false,
        alias: "t",
      },
      {
        name: "deleteData",
        description: "Delete all data from schemas associated with this provider",
        type: "boolean",
        defaultValue: false,
        alias: "d",
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
      `Reseting ${options.provider} on network ${options.network}. (resetPositions=true, deleteData=${options.deleteData}, clearTokens=${options.clearTokens})`
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

    const syncManager = new SyncManager(
      await networkInstance.account.did(),
      serverconfig.verida.testVeridaKey
    )

    const providers = await syncManager.getProviders(options.provider)
    const provider = providers[0]

    console.log('Reset started')
    const deleteCount = await provider.reset(options.deleteData, options.clearTokens)
    console.log(`Reset complete, deleted ${deleteCount} items`)

    await vault.close()
  },
};
