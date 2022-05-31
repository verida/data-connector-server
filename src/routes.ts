import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/connect/:provider', Controller.connect)
router.get('/callback/:provider', Controller.callback)
router.get('/sync/:provider', Controller.sync)
router.get('/syncDone/:provider', Controller.syncDone)
router.get('/test1', Controller.test1)
router.get('/test2', Controller.test2)


export default router