import express from 'express'

import { ControllerV1 } from './controller'

const controllerV1 = new ControllerV1()

export const routerV1 = express.Router()

routerV1.post('/data', (req, res) => controllerV1.saveData(req, res))
