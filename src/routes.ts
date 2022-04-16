import express from 'express'
import ConnectorsController from './connectorsController'

const router = express.Router()

router.get('/connect/:connector', ConnectorsController.connect)
router.get('/callback/:connector', ConnectorsController.callback)
router.get('/sync/:connector', ConnectorsController.sync)
router.get('/syncDone/:connector', ConnectorsController.syncDone)

export default router