import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get("/universal", controller.universal)
router.get("/chatThreads", controller.chatThreads)
router.post(/datastore\/(.*)$/, controller.datastore)

export default router