import express from 'express'

import DbRoutes from './db/routes'
import DsRoutes from './ds/routes'
import AdminRoutes from './admin/routes'
import LLMRoutes from './llm/routes'
import MiniSearchRoutes from './minisearch/routes'
import BaseRoutes from './base/routes'

const router = express.Router()

router.use(BaseRoutes)
router.use('/db', DbRoutes)
router.use('/ds', DsRoutes)
router.use('/admin', AdminRoutes)
router.use('/llm', LLMRoutes)
router.use('/minisearch', MiniSearchRoutes)

export default router