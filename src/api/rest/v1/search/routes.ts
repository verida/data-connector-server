import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()

router.get("/universal", auth({
    scopes: ["api:search-universal"]
}), controller.universal)

router.get("/chatThreads", auth({
    scopes: ["api:search-chat-threads"]
}), controller.chatThreads)

router.post("/datastore/:schema", auth({
    scopes: ["api:search-ds"],
    dsScope: "r"
}), controller.datastore)

export default router