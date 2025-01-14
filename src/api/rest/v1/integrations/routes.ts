import express from 'express'

import { routerV1 as nillionRouterV1 } from './nillion/routes'

export const routerV1 = express.Router()

routerV1.use('/nillion', nillionRouterV1)
