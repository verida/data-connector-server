import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";
import CONFIG from "../../../../config"

const router = express.Router()

router.get("/universal", auth({
    scopes: ["api:search-universal"],
    credits: CONFIG.verida.billing.defaultCredits
}), controller.universal)

router.get("/chatThreads", auth({
    scopes: ["api:search-chat-threads"],
    credits: CONFIG.verida.billing.defaultCredits
}), controller.chatThreads)

router.post("/datastore/:schema", auth({
    scopes: ["api:search-ds"],
    dsScope: "r",
    credits: CONFIG.verida.billing.defaultCredits
}), controller.datastore)

export default router