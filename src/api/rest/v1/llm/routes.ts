import express from 'express'
import { controller } from './controller'

const router = express.Router()
router.post('/prompt', controller.prompt)
router.post('/personal', controller.personalPrompt)
router.post('/profile', controller.profilePrompt)
router.get('/hotload', controller.hotLoad)
router.post('/langchain', controller.langchain)

export default router