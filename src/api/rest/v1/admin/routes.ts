import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()

router.get(/logs$/, auth({
    options: { checkAdmin: true }
}), controller.logs)

router.get(/clearLogs$/, auth({
    options: { checkAdmin: true }
}), controller.clearLogs)

export default router