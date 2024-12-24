import express from 'express'
import Controller from './controller'

const router = express.Router()

router.post('/apiKeySubmit', Controller.apiKeySubmit)

export default router