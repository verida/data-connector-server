import express from 'express'
import restRoutes from './api/rest/routes'
import Controller from './api/rest/v1/base/controller'

const router = express.Router()
router.use('/api/rest', restRoutes)

// Add default callback handler for third party callbacks
router.get('/callback/:provider', Controller.callback)

export default router