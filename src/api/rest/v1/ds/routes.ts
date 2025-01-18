import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()

router.get(/get\/(.*)\/(.*)$/,  auth({
    scopes: ["api:ds-get-by-id"],
    dbScope: "r"
}), controller.getById)

router.post(/query\/(.*)$/, auth({
    scopes: ["api:ds-query"],
    dbScope: "r"
}),  controller.query)

router.delete("/:schema", auth({
    scopes: ["api:ds-delete"],
    dbScope: "d"
}),  controller.delete)

router.delete("/:schema/:recordId", auth({
    scopes: ["api:ds-delete"],
    dbScope: "d"
}),  controller.delete)

router.get(/watch\/(.*)$/, auth({
    scopes: ["api:ds-query"],
    dbScope: "r"
}),  controller.watch)

router.post("/:schema", auth({
    scopes: ["api:ds-create"],
    dbScope: "w"
}),  controller.create)

router.put("/:schema/:recordId", auth({
    scopes: ["api:ds-update"],
    dbScope: "w"
}), controller.update)


export default router