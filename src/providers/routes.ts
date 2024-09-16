import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/connect/:provider', Controller.connect)
router.get('/callback/:provider', Controller.callback)

export default router