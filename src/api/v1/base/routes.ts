import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/providers', Controller.providers)

router.get('/provider/connect/:provider', Controller.connect)
router.get('/provider/disconnect/:provider', Controller.disconnect)
router.get('/callback/:provider', Controller.callback)

router.get('/sync/status', Controller.syncStatus)
router.get('/sync/logs', Controller.logs)
router.get('/sync', Controller.sync)

export default router