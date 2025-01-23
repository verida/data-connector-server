const app = require('./server-app');
import UsageManager from "./services/usage/manager"
import BillingManager from "./services/billing/manager"

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;


// app.listen(PORT, () => {
//   console.log(`server running on port ${PORT}`);
// });

const https = require("https")
const fs = require("fs")

const key = fs.readFileSync("./keys/server.key")
const cert = fs.readFileSync("./keys/server.cert")

https.createServer(
    {
      key,
      cert
    },
    app
  ).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  UsageManager.buildIndexes()
  BillingManager.buildIndexes()
});