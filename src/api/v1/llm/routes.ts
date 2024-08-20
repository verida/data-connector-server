import express from 'express'
import { controller } from './controller'

const router = express.Router()
router.post('/prompt', controller.prompt)
router.post('/personal', controller.personalPrompt)

export default router