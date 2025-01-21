import express from 'express'
import Controller from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()

router.get('/usage', auth(), Controller.usage)

export default router