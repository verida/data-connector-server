import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get(/get\/(.*)\/(.*)$/, controller.getById)
router.post(/query\/(.*)$/, controller.query)
router.delete(/([^\/]*)$/, controller.delete)
router.get(/watch\/(.*)$/, controller.watch)
router.post(/save\/(.*)$/, controller.create)
router.put(/save\/(.*)\/(.*)$/, controller.update)


export default router