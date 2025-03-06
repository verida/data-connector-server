const app = require('./server-app');
import UsageManager from "./services/usage/manager"
import BillingManager from "./services/billing/manager"
import { BackgroundSyncManager } from "./services/backgroundSync";
require('dotenv').config()

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;
const SSL_ENABLED = process.env.SSL_ENABLED ? process.env.SSL_ENABLED : false;

const https = require("https")
const fs = require("fs")

let server: any = undefined
if (SSL_ENABLED) {
  const key = fs.readFileSync("./keys/server.key")
  const cert = fs.readFileSync("./keys/server.cert")

  server = https.createServer(
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
} else {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    UsageManager.buildIndexes()
    BillingManager.buildIndexes()
    BackgroundSyncManager.start()
  });
}

function shutdown() {
  console.log('Received shutdown signal, shutting down gracefully...');
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });
  // Force shutdown if not closed in 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Listen for termination signal and close the server gracefully
process.on('SIGTERM', () => {
  shutdown()
});

process.on('SIGINT', () => {
  shutdown()
});
