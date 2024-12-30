import express, { Request, Response } from "express";
// import { OAuthMemoryDb } from "./db";
// import { OAuthModel } from "./model";
import { Utils } from "../../../../utils";
import { VeridaOAuthClient } from "./client";
import VeridaOAuthServer from "./server";
const OAuthServer = require("@node-oauth/express-oauth-server");
import CONFIG from "../../../../config"

const loggedInUsers: Record<string, string> = {};

// const db = new OAuthMemoryDb();
// const model = new OAuthModel(db);

// db.saveClient({
//   id: "client_id",
//   secret: "client_secret",
//   grants: ["authorization_code", "refresh_token"],
// });

const oauth = new OAuthServer({
  model: VeridaOAuthServer,
});

const router = express.Router();

/**
 * Generate an authorization code for a third party application to exchange for refresh
 * and access tokens.
 */
router.get("/auth", async (req: Request, res: Response) => {
  console.log(req.query)
  const { client_id, auth_request, redirect_uri, consent_sig, state, returnCode } = req.query;

  if (!client_id) {
    return res.status(400).json({ error: "Invalid client or redirect URI" });
  }

  const client = new VeridaOAuthClient(client_id.toString())
  if (!redirect_uri || !auth_request || !consent_sig) {
    return res.status(400).json({ error: "Missing client, redirect URI or auth request" });
  }

  try {
    await client.verifyRequest(redirect_uri.toString(), auth_request.toString(), consent_sig.toString())
    const authRequestId = await VeridaOAuthServer.generateAuthorizationCode(auth_request.toString(), redirect_uri.toString())

    if (CONFIG.verida.devMode && returnCode) {
      // We are in dev mode and have been asked to return the code, so do that without redirecting
      // This is used for testing purposes
      return res.json({
        auth_code: authRequestId
      })
    } else {
      // Redirect the user to the third party applicatino with a valid auth_code that can
      // be used to retrieve access and refresh tokens.
      return res.redirect(`${redirect_uri}?auth_code=${authRequestId}&state=${state}`);
    }
  } catch (err) {
    return res.status(400).json({ error: `Invalid auth request: ${err.message}`})
  }
});

router.use("/token", oauth.token());

router.get("/test", oauth.authenticate(), async function (req, res) {
  // @ts-ignore
  console.log(res.locals.oauth);
  res.send({ authenticated: true });
});

// router.get("/login", async (req: Request, res: Response) => {
//   const { privateKey } = req.body;

//   // Authenticate the user
//   try {
//       const connection = await Utils.getNetworkFromRequest(req)
//       loggedInUsers[connection.did] = privateKey

//         // Retrieve the stored OAuth request details from the session
//         const { client_id, redirect_uri, scope, state } = req.session.oauthRequest;

//         // Generate an authorization code
//         const authorizationCode = await model.generateAuthorizationCode(
//             client_id,
//             { privateKey, did: connection.did },
//             scope
//         );

//         // Redirect back to the client with the authorization code
//         const redirectUrl = `${redirect_uri}?code=${authorizationCode}&state=${state}`;
//         res.redirect(redirectUrl);
//     } catch (err: any) {
//         return res.status(401).json({ error: "Invalid credentials" });
//     }
// });

export default router;
