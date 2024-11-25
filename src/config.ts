const _ = require('lodash')
import serverconfig from "./serverconfig.example.json";

let localconfig = {};
try {
  localconfig = require("../src/serverconfig.local.json");
} catch (err) {
  console.log(err)
  if (err.code !== "MODULE_NOT_FOUND") {
    throw err;
  }
}

// TODO: Define a Zod schema for the config and validate the imported JSON
// TODO: Avoid using example.json as ... it's an example, the config should be explicit, if the local is not valid because of missing values, throw an error.
export default _.merge({}, serverconfig, localconfig);
