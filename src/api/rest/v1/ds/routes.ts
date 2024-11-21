import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get(/get\/(.*)\/(.*)$/, controller.getById)
router.post(/query\/(.*)$/, controller.query)
router.delete("/:schema", controller.delete)
router.delete("/:schema/:recordId", controller.delete)
router.get(/watch\/(.*)$/, controller.watch)
router.post("/:schema", controller.create)
router.put("/:schema/:recordId", controller.update)


export default router