import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/connect/:provider', Controller.connect)
router.get('/callback/:provider', Controller.callback)
router.get('/sync/:provider', Controller.sync)
router.post('/syncStart/:provider', Controller.syncStart)
router.get('/syncDone/:provider', Controller.syncDone)

export default router