import express, { Request, Response } from "express";
import { OAuthMemoryDb } from "./db";
import { createModel } from "./model";
import { Utils } from "../../../../utils";
const OAuthServer = require("@node-oauth/express-oauth-server");

const loggedInUsers: Record<string, string> = {};

const db = new OAuthMemoryDb();
const model = createModel(db);

db.saveClient({
  id: "client_id",
  secret: "client_secret",
  grants: ["authorization_code"],
});

const oauth = new OAuthServer({
  model,
});

const router = express.Router();
router.use("/token", oauth.token());

router.get("/test", oauth.authenticate(), async function (req, res) {
  // @ts-ignore
  console.log(res.locals.oauth);
  res.send({ authenticated: true });
});

router.get("/auth", async (req: Request, res: Response) => {
  const { client_id, redirect_uri, scope, response_type, state } = req.query;

  // Validate the client (ensure the client_id and redirect_uri are registered)
  const client = await model.getClient(client_id as string, null);
  if (!client || !client.redirectUris.includes(redirect_uri as string)) {
    return res.status(400).json({ error: "Invalid client or redirect URI" });
  }

  // Save the request details (optional: store in session or DB) for use after user login
  req.session.oauthRequest = { client_id, redirect_uri, scope, state };

  // Redirect the user to the login page
  res.redirect(`/auth?client_id=${client_id}&scope=${scope}`);
});

router.get("/login", async (req: Request, res: Response) => {
  const { privateKey } = req.body;

  // Authenticate the user
  try {
      const connection = await Utils.getNetworkFromRequest(req)
      loggedInUsers[connection.did] = privateKey

        // Retrieve the stored OAuth request details from the session
        const { client_id, redirect_uri, scope, state } = req.session.oauthRequest;

        // Generate an authorization code
        const authorizationCode = await model.generateAuthorizationCode(
            client_id,
            { privateKey, did: connection.did },
            scope
        );

        // Redirect back to the client with the authorization code
        const redirectUrl = `${redirect_uri}?code=${authorizationCode}&state=${state}`;
        res.redirect(redirectUrl);
    } catch (err: any) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
});

export default router;
