import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get(/logs$/, controller.logs)
router.get(/clearLogs$/, controller.clearLogs)

export default router