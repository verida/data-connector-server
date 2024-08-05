import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/connect/:provider', Controller.connect)
router.get('/callback/:provider', Controller.callback)
router.get('/sync', Controller.sync)
router.get('/syncStatus', Controller.syncStatus)
router.get('/providers', Controller.providers)

export default router