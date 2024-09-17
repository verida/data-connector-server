import express from 'express'
import restRoutes from './api/rest/routes'
import providerRoutes from './providers/routes'
import providerController from './providers/controller'

const router = express.Router()
router.use('/api/rest', restRoutes)
router.use('/providers', providerRoutes)

// @deprecated callback path, but added for backwards compatibility
router.get('/callback/:provider', providerController.callback)

export default router