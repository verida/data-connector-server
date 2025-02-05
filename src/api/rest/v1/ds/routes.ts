import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";
import CONFIG from "../../../../config"

const router = express.Router()

router.get("/get/:schema/:recordId", auth({
    scopes: ["api:ds-get-by-id"],
    dsScope: "r",
    credits: CONFIG.verida.billing.defaultCredits
}), controller.getById)

router.post("/query/:schema", auth({
    scopes: ["api:ds-query"],
    dsScope: "r",
    credits: CONFIG.verida.billing.defaultCredits
}),  controller.query)

router.delete("/:schema", auth({
    scopes: ["api:ds-delete"],
    dsScope: "d",
    credits: CONFIG.verida.billing.defaultCredits
}),  controller.delete)

router.delete("/:schema/:recordId", auth({
    scopes: ["api:ds-delete"],
    dsScope: "d",
    credits: CONFIG.verida.billing.defaultCredits
}),  controller.delete)

router.get("/watch/:schema", auth({
    scopes: ["api:ds-query"],
    dsScope: "r",
    credits: CONFIG.verida.billing.defaultCredits
}),  controller.watch)

router.post("/:schema", auth({
    scopes: ["api:ds-create"],
    dsScope: "w",
    credits: CONFIG.verida.billing.defaultCredits
}),  controller.create)

router.put("/:schema/:recordId", auth({
    scopes: ["api:ds-update"],
    dsScope: "w",
    credits: CONFIG.verida.billing.defaultCredits
}), controller.update)


export default router