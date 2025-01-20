import express from "express";
import { controller } from "./controller"

const router = express.Router();

router.post("/auth", controller.auth);
router.get("/check-scope", controller.checkScope);
router.get("/revoke", controller.revoke);
router.post("/token", controller.createToken)
router.get("/token", controller.token)
router.get("/tokens", controller.tokens)
router.get("/scopes", controller.scopes)
router.get("/resolve-scopes", controller.resolveScopes)

export default router;
