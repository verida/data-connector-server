import { UniqueRequest } from './interfaces'
import express, { Response, NextFunction } from 'express'
const cors = require('cors')
import bodyParser from 'body-parser'
import router from './routes'
// @todo: See not in express-session about not using memory session
const session = require('express-session')
import { v4 as uuidv4 } from 'uuid';

const log4js = require("log4js")
const logger = log4js.getLogger()
import CONFIG from "./config"
logger.level = CONFIG.logLevel

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


module.exports=app