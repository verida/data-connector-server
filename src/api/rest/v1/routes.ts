import express from 'express'

import { routerV1 as accessRouterV1 } from './access/routes'
import ProviderRoutes from './providers/routes'
import ConnectionRoutes from './connections/routes'
import DbRoutes from './db/routes'
import DsRoutes from './ds/routes'
import AdminRoutes from './admin/routes'
import InfoRoutes from './info/routes'
import LLMRoutes from './llm/routes'
import TelegramRoutes from './telegram/routes'
import SearchRoutes from "./search/routes"
import AccountRoutes from './account/routes'
import { routerV1 as integrationsRouterV1 } from './integrations/routes'

export const routerV1 = express.Router()

routerV1.use('/access', accessRouterV1)
routerV1.use('/providers', ProviderRoutes)
routerV1.use('/connections', ConnectionRoutes)
routerV1.use('/db', DbRoutes)
routerV1.use('/ds', DsRoutes)
routerV1.use('/admin', AdminRoutes)
routerV1.use('/info', InfoRoutes)
routerV1.use('/llm', LLMRoutes)
routerV1.use('/search', SearchRoutes)
routerV1.use('/account', AccountRoutes)
routerV1.use('/integrations', integrationsRouterV1)
routerV1.use('/telegram', TelegramRoutes)
