import express from 'express'
import Controller from './controller'
import TelegramRoutes from './telegram/routes'

const router = express.Router()

router.get('/connect/:provider', Controller.connect)
router.get('/disconnect/:provider', Controller.disconnect)
router.get('/callback/:provider', Controller.callback)

router.get('/sync', Controller.sync)
router.get('/syncStatus', Controller.syncStatus)

router.get('/providers', Controller.providers)
router.get('/data', Controller.data)
router.get('/logs', Controller.logs)

router.use('/telegram', TelegramRoutes)

export default router