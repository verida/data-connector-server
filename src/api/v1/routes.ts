import express from 'express'

import DbRoutes from './db/routes'
import DsRoutes from './ds/routes'
import AdminRoutes from './admin/routes'
import LLMRoutes from './llm/routes'
import MiniSearchRoutes from './minisearch/routes'
import BaseRoutes from './base/routes'
import TelegramRoutes from './telegram/routes'
import Search from "./search/routes"

const router = express.Router()

router.use(BaseRoutes)
router.use('/db', DbRoutes)
router.use('/ds', DsRoutes)
router.use('/admin', AdminRoutes)
router.use('/llm', LLMRoutes)
router.use('/minisearch', MiniSearchRoutes)
router.use('/search', Search)

router.use('/telegram', TelegramRoutes)

export default router