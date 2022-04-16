import express from 'express'
const cors = require('cors')
import bodyParser from 'body-parser'
import router from './routes'
//const basicAuth = require('express-basic-auth')
//import RequestValidator from './request-validator'

import dotenv from 'dotenv'
dotenv.config();

// Set up the express app
const app = express();
//const validator = new RequestValidator()

const corsConfig = {}

// Parse incoming requests data
app.use(cors(corsConfig))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
// Commenting out authorization for now
/*app.use(basicAuth({
  authorizer: validator.authorize,
  authorizeAsync: true,
  unauthorizedResponse: validator.getUnauthorizedResponse
}))*/
app.use(router)

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
});

/*
//Example code to create HTTPS server

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
  console.log(`server running on port ${PORT}`)
});*/