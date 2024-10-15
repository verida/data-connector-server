import express from 'express'
import { controller } from './controller'

const router = express.Router()

router.get(/fromKey$/, controller.fromKey)

export default router