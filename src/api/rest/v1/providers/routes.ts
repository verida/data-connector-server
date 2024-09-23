import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/', Controller.providers)
router.get('/:providerId', Controller.provider)

export default router