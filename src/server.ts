const app = require('./server-app');
import UsageManager from "./services/usage/manager"
import BillingManager from "./services/billing/manager"
import { BackgroundSyncManager } from "./services/backgroundSync";
require('dotenv').config()

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;

// app.listen(PORT, () => {
//   console.log(`server running on port ${PORT}`);
// });

const https = require("https")
const fs = require("fs")

const key = fs.readFileSync("./keys/server.key")
const cert = fs.readFileSync("./keys/server.cert")

const server = https.createServer(
    {
      key,
      cert
    },
    app
  ).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  UsageManager.buildIndexes()
  BillingManager.buildIndexes()
  BackgroundSyncManager.start()
});

// Listen for termination signal and close the server gracefully
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });
  // Force shutdown if not closed in 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});