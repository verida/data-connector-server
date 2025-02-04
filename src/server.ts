const app = require('./server-app');
import UsageManager from "./services/usage/manager"
import BillingManager from "./services/billing/manager"

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  UsageManager.buildIndexes()
  BillingManager.buildIndexes()
});