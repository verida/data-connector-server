import serverconfig from "./serverconfig.example.json";

let localconfig = {};
try {
  localconfig = require("../src/serverconfig.local.json");
} catch (err) {
  if (err.code !== "MODULE_NOT_FOUND") {
    throw err;
  }
}

export default {
  ...serverconfig,
  ...localconfig,
};
