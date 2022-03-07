import express from 'express'
import DemoController from './demoController'

const router = express.Router()

router.post('/echo', DemoController.echo)
router.get('/error', DemoController.error)

export default router