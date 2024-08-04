import CONFIG from "../config";

export function validateNetwork(val: string) {
  const valid = ["banksia", "myrtle"];
  if (valid.indexOf(val) === -1) {
    return false;
  }
}

type CommandParamType = "string" | "number" | "boolean";

export const COMMAND_PARAMS = {
    key: {
        name: "key",
        description: "Verida network private key (or seed phrase)",
        type: "string" as CommandParamType,
        defaultValue: CONFIG.verida.testVeridaKey,
        alias: "k",
    },
    network: {
        name: "network",
        description: "Verida network (banksia, myrtle)",
        type: "string" as CommandParamType,
        alias: "n",
        defaultValue: "mainnet",
        validate: validateNetwork
    },
}