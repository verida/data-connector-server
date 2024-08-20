import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/login', Controller.login)
router.post('/loginSubmit', Controller.loginSubmit)

export default router