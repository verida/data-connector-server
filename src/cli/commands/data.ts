import { Command } from "command-line-interface";
import { DataOptions } from "./interfaces";
import { AutoAccount } from "@verida/account-node";
import { Network } from "@verida/types";
import CONFIG from "../../config";
import { Utils } from "../../utils";
import { SchemaRecord } from "../../schemas";
import { COMMAND_PARAMS } from "../utils";

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
      name: "sortField",
      description: "Default sort field",
      type: "string",
      defaultValue: "insertedAt",
    },
    {
      name: "attributes",
      description:
        "Comma separated list of attributes to output (ie: _id,name)",
      type: "string",
    },
    {
      name: "filter",
      description:
        "Comma separated list of filters to apply to output (ie: provider=google,providerId=1234567890)",
      type: "string",
      alias: "f"
    },
    COMMAND_PARAMS.key,
    COMMAND_PARAMS.network,
  ],
  async handle({ options }) {
    console.log(
      `-- Fetching data for schema ${options.schemaUri} on network ${options.network}.`
    );

    if (!options.key) {
      console.log(`No key specified from command line or environment variable`);
      return;
    }

    if (options.filter) {
      console.log(`Filter: ${JSON.stringify(options.filter)}`)
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
    const vault = networkInstance.context;
    const dataDs = await vault.openDatastore(options.schemaUri);
    console.time("Database load");
    const dataDb = await dataDs.getDb();
    const dataPouchDb = await dataDb.getDb();
    const dataPouchInfo = await dataPouchDb.info();
    console.timeEnd("Database load");

    const sort: Record<string, string> = {};
    sort[options.sortField] = "desc";
    console.time("Get first 5 items");

    const filter: Record<string, string> = {}
    if (options.filter) {
      const filterAttributes = options.filter ? options.filter.split(",") : [];
      for (const attribute of filterAttributes) {
        const [key, value] = attribute.split('=')
        filter[key] = value
      }
    }

    const first5Items = <SchemaRecord[]>await dataDs.getMany(
      {},
      {
        sort: [sort],
        limit: 5,
      }
    );
    console.timeEnd("Get first 5 items");

    sort[options.sortField] = "asc";
    console.time("Get last 5 items");
    const last5Items = <SchemaRecord[]>await dataDs.getMany(
      {},
      {
        sort: [sort],
        limit: 5,
      }
    );
    console.timeEnd("Get last 5 items");

    const attributes = options.attributes ? options.attributes.split(",") : [];

    console.log("-- First five items");
    printItems(first5Items, attributes);
    console.log("-- Last five items");
    printItems(last5Items, attributes);

    console.log(`-- Total rows: ${dataPouchInfo.doc_count}`);

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
