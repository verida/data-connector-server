import { Command } from "command-line-interface";
import { DataOptions } from "./interfaces";
import { AutoAccount } from "@verida/account-node";
import { Network } from "@verida/types";
import CONFIG from "../../config";
import { Utils } from "../../utils";

export const Data: Command<DataOptions> = {
  name: "Data",
  description: `Show data for a given schema`,
  optionDefinitions: [
    {
      name: "schemaUri",
      description: "Schema URI",
      type: "string",
      alias: "s",
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
      `-- Fetching data for schema ${options.schemaUri} on network ${options.network}.`
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
    console.log(`-- Verida Account has DID: ${did}`);

    const networkInstance = await Utils.getNetwork(did, options.key);
    const vault = networkInstance.context
    const dataDs = await vault.openDatastore(options.schemaUri)
    const dataDb = await dataDs.getDb()
    const dataPouchDb = await dataDb.getDb()
    const dataPouchInfo = await dataPouchDb.info()

    const first5Items = await dataDs.getMany({}, {
        sort: [{'insertedAt': 'desc'}],
        limit: 5
    })

    const last5Items = await dataDs.getMany({}, {
        sort: [{'insertedAt': 'asc'}],
        limit: 5
    })

    console.log('-- First five items')
    console.log(first5Items)
    console.log('-- Last five items')
    console.log(last5Items)

    console.log(`-- Total rows: ${dataPouchInfo.doc_count}`)

    await vault.close()
  },
};
