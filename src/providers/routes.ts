import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/:providerId/connect', Controller.connect)
router.get('/:providerId/callback', Controller.callback)

export default router