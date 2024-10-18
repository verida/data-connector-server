import express from 'express'

import ProviderRoutes from './providers/routes'
import ConnectionRoutes from './connections/routes'
import DbRoutes from './db/routes'
import DsRoutes from './ds/routes'
import AdminRoutes from './admin/routes'
import LLMRoutes from './llm/routes'
import TelegramRoutes from './telegram/routes'
import SearchRoutes from "./search/routes"
import AccountRoutes from './account/routes'

const router = express.Router()

router.use('/providers', ProviderRoutes)
router.use('/connections', ConnectionRoutes)
router.use('/db', DbRoutes)
router.use('/ds', DsRoutes)
router.use('/admin', AdminRoutes)
router.use('/llm', LLMRoutes)
router.use('/search', SearchRoutes)
router.use('/account', AccountRoutes)

router.use('/telegram', TelegramRoutes)

export default router