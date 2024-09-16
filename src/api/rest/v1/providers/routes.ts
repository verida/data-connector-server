import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/', Controller.providers)

export default router