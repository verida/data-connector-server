import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";
import CONFIG from "../../../../config"

const router = express.Router()

router.get("/get/:database/:recordId", auth({
    scopes: ["api:db-get-by-id"],
    dbScope: "r",
    credits: CONFIG.verida.billing.defaultCredits
}), controller.getById)

router.post("/count/:database", auth({
    scopes: ["api:db-query"],
    dbScope: "r",
    credits: 0
}), controller.count)

router.post("/query/:database", auth({
    scopes: ["api:db-query"],
    dbScope: "r",
    credits: CONFIG.verida.billing.defaultCredits
}), controller.query)

router.post("/:database", auth({
    scopes: ["api:db-create"],
    dbScope: "w",
    credits: CONFIG.verida.billing.defaultCredits
}), controller.create)

router.put("/:database/:recordId", auth({
    scopes: ["api:db-get-by-id"],
    dbScope: "w",
    credits: CONFIG.verida.billing.defaultCredits
}), controller.update)


export default router