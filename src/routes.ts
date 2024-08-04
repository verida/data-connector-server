import express from 'express'
import v1Routes from './api/v1/routes'
import Controller from './api/v1/controller'

const router = express.Router()
router.use('/api/v1/', v1Routes)

// Add default callback handler for third party callbacks
router.get('/callback/:provider', Controller.callback)

export default router