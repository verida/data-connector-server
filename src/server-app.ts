import express from 'express'
const cors = require('cors')
import bodyParser from 'body-parser'
import router from './api/v1/routes'
// @todo: See not in express-session about not using memory session
const session = require('express-session')

const log4js = require("log4js")
const logger = log4js.getLogger()
import CONFIG from "./config"
logger.level = CONFIG.logLevel

const path = require('path')

//const basicAuth = require('express-basic-auth')
//import RequestValidator from './request-validator'

// Set up the express app
const app = express();
//const validator = new RequestValidator()

console.log(path.join(__dirname, 'assets'))
app.use('/assets', express.static(path.join(__dirname, 'assets')))
app.use(session({
  secret: 'c20n498n720489t729amx9 8es',
  resave: false,
  saveUninitialized: true,
  // Enable this if HTTPS is enabled (ie: production)
  // cookie: { secure: false }
}))

// Parse incoming requests data
const corsConfig = {}
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


module.exports=app

/*
//Example code to create HTTPS server (for facebook testing)

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