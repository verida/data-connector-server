import express from 'express'
import Controller from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()
const appAuth = auth({
    options: {
        // App DID's don't need to be whitelisted
        ignoreAccessCheck: true
    }
})

router.get('/requests', appAuth, Controller.requests)
router.get('/account-count', appAuth, Controller.accountCount)
router.get('/usage', appAuth, Controller.usage)
router.get('/balance', appAuth, Controller.balance)
router.get('/deposits', appAuth, Controller.deposits)

export default router