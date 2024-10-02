import { UniqueRequest } from './interfaces'
import express, { Response, NextFunction } from 'express'
import { Utils } from './utils'
const cors = require('cors')
import bodyParser from 'body-parser'
import router from './routes'
// @todo: See not in express-session about not using memory session
const session = require('express-session')
import { v4 as uuidv4 } from 'uuid';

const log4js = require("log4js")
import CONFIG from "./config"

// Configure log4js
const LOG_CONFIG: any = {
  appenders: {
    console: { type: 'console' } // Log to the console
  },
  categories: {
    default: { appenders: ['console'], level: CONFIG.verida.logging.level } // Logs both file and console
  }
}

if (CONFIG.verida.logging.logToFile) {
  // Enable file logging
  LOG_CONFIG.appenders.file = { type: 'file', filename: CONFIG.verida.logging.logToFile }
  LOG_CONFIG.categories.default.appenders.push('file')
}

log4js.configure(LOG_CONFIG)

// Get the logger instance
const logger = log4js.getLogger();

// Replace the console.log, console.error, etc. with log4js loggers
console.log = (...args) => logger.info(...args);
console.error = (...args) => logger.error(...args);
console.warn = (...args) => logger.warn(...args);
console.debug = (...args) => logger.debug(...args);

const path = require('path')

function requestIdMiddleware(req: UniqueRequest, res: Response, next: NextFunction): void {
  req.requestId = uuidv4();
  next();
}


// Set up the express app
const app = express();

app.use(requestIdMiddleware)
app.use('/assets', express.static(path.join(__dirname, 'assets')))
app.use('/', express.static(path.join(__dirname, 'web')))
app.use(session({
  secret: CONFIG.verida.sessionSecret,
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

if (CONFIG.verida.devMode) {
  console.log("Server is in development mode")
} else {
  Utils.deleteCachedData()
}

console.log('In alpha release')

module.exports=app