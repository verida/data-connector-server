import express from 'express'
import restRoutes from './api/rest/routes'
import providerRoutes from './providers/routes'

const router = express.Router()
router.use('/api/rest', restRoutes)
router.use('/providers', providerRoutes)

export default router