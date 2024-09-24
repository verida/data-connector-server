import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get(/get\/(.*)\/(.*)$/, controller.getById)
router.post(/query\/(.*)$/, controller.query)


export default router