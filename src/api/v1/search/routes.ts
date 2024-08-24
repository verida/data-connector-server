
import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get("/email", controller.email)
router.get("/chatHistory", controller.chatHistory)
router.get("/chatThreads", controller.chatThreads)
router.get("/universal", controller.universal)
router.get("/hotload", controller.hotLoad)


export default router