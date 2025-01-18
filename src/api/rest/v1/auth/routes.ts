import express from "express";
import { controller } from "./controller"
import auth from "../../../../middleware/auth";

const router = express.Router();
const defaultAuth = auth()
const sessionAuth = auth({ sessionRequired: true })

router.post("/auth", sessionAuth, controller.auth);
router.get("/check-scope", defaultAuth, controller.checkScope);
router.get("/revoke", defaultAuth, controller.revoke);
router.post("/token", sessionAuth, controller.createToken)
router.get("/token", controller.token)
router.get("/tokens", defaultAuth, controller.tokens)
router.get("/scopes", controller.scopes)
router.get("/resolve-scopes", controller.resolveScopes)

export default router;
