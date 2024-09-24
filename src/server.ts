/*
This lets us run the Express server locally 
*/
const app = require('./server-app');

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

// const https = require("https")
// const fs = require("fs")

// const key = fs.readFileSync("./keys/server.key")
// const cert = fs.readFileSync("./keys/server.cert")

// https.createServer(
//     {
//       key,
//       cert
//     },
//     app
//   ).listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`)
// });