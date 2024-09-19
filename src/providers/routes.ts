import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/:provider/connect', Controller.connect)
router.get('/:provider/callback', Controller.callback)

export default router