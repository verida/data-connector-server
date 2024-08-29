import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get(/get\/(.*)\/(.*)$/, controller.getById)
router.get(/get\/(.*)$/, controller.get)
router.post(/query\/(.*)$/, controller.query)

router.delete(/([^\/]*)$/, controller.delete)


export default router