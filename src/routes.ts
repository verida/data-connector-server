import express from 'express'
import Controller from './controller'
import SbtController from './sbtController'

const router = express.Router()

router.get('/connect/:provider', Controller.connect)
router.get('/callback/:provider', Controller.callback)
router.get('/sync/:provider', Controller.sync)
router.post('/syncStart/:provider', Controller.syncStart)
router.get('/syncDone/:provider', Controller.syncDone)

router.post('/mintSbt', SbtController.mintSbt)

export default router