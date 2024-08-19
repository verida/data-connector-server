
import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get("/search/email", controller.email)
router.get("/search/chatHistory", controller.chatHistory)
router.get("/hotload", controller.hotLoad)


export default router