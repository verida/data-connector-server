import express from 'express'
import Controller from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()
const sessionAuth = auth({
    sessionRequired: true,
    options: {
        // App DID's don't need to be whitelisted
        ignoreAccessCheck: true
    }
})

router.get('/requests', sessionAuth, Controller.requests)
router.get('/account-count', sessionAuth, Controller.accountCount)
router.get('/usage', sessionAuth, Controller.usage)

export default router