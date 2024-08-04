import express from 'express'
const cors = require('cors')
import bodyParser from 'body-parser'
import router from './routes'
// @todo: See not in express-session about not using memory session
const session = require('express-session')

const log4js = require("log4js")
const logger = log4js.getLogger()
import CONFIG from "./config"
logger.level = CONFIG.logLevel

const path = require('path')

// Set up the express app
const app = express();

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
app.use(router)


module.exports=app