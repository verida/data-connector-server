import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()

router.get("/get/:database/:recordId", auth({
    scopes: ["api:db-get-by-id"],
    dbScope: "r"
}), controller.getById)

router.post("/query/:database", auth({
    scopes: ["api:db-query"],
    dbScope: "r"
}), controller.query)

router.post("/:database", auth({
    scopes: ["api:db-create"],
    dbScope: "w"
}), controller.create)

router.put("/:database/:recordId", auth({
    scopes: ["api:db-get-by-id"],
    dbScope: "w"
}), controller.update)


export default router