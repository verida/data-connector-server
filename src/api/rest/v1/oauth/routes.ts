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
router.post("/auth", async (req: Request, res: Response) => {
  const { context, sessionString } = await Utils.getNetworkConnectionFromRequest(req)
  const { client_id, auth_request, redirect_uri, user_sig, state } = req.body;

  if (!sessionString) {
    return res.status(400).json({ error: "Invalid user session key"});
  }

  if (!client_id) {
    return res.status(400).json({ error: "Invalid client or redirect URI" });
  }

  const client = new VeridaOAuthClient(client_id.toString())
  if (!redirect_uri) {
    return res.status(400).json({ error: "Missing redirect URI," });
  }

  if (!auth_request) {
    return res.status(400).json({ error: "Missing auth request" });
  }

  if (!user_sig) {
    return res.status(400).json({ error: "Missing user signature" });
  }

  try {
    const authRequest = await client.verifyRequest(context, redirect_uri.toString(), auth_request.toString(), user_sig.toString())
    const authToken = await VeridaOAuthServer.generateAuthToken(authRequest, context, sessionString)

    // Redirect the user to the third party application with a valid auth_code that can
    // be used to retrieve access and refresh tokens.
    return res.redirect(`${redirect_uri}?auth_token=${encodeURIComponent(authToken)}&state=${state}`);
  } catch (err) {
    return res.status(400).json({ error: `Invalid auth request: ${err.message}`})
  }
});

/**
 * Check if an access token has a given scope
 */
router.get("/check-scope", async function (req, res) {
  const scope = req.query.scope.toString()

  try {
    const { context } = await Utils.getNetworkConnectionFromRequest(req, {
      scope
    })

    res.send({ authenticated: true });
  } catch (err) {
    if (err.message.match('invalid scope')) {
      res.send({ authenticated: false });
    } else {
      if (err.message.match('Invalid token')) {
        return res.status(403).json({ error: err.message })
      }

      return res.status(400).json({ error: `Invalid request: ${err.message}`})
    }
  }
});

router.get("/revoke", async function (req, res) {
  const tokenId = req.query.tokenId.toString()

  try {
    // We set a scope of `revoke-tokens` to prevent auth tokens from being able to revoke
    // tokens unless they have the `revoke-tokens` scope (which is intentionally impossible
    // as `revoke-toknes` scope is intentionally force removed from any requested scopes)
    const { context } = await Utils.getNetworkConnectionFromRequest(req, {
      scope: "access-tokens"
    })

    await VeridaOAuthServer.revokeToken(context, tokenId)
    res.send({ revoked: true });
  } catch (err) {
    if (err.message.match('Invalid token')) {
      return res.status(403).json({ error: err.message })
    }

    console.error(err)
    return res.status(400).json({ error: `Invalid request: ${err.message}`})
  }
});

// @todo Get details about a token (did, scopes)
router.get("/token", async function (req, res) {
  const tokenId = req.query.tokenId.toString()

  try {
    const { context } = await Utils.getNetworkConnectionFromRequest(req)

    // @todo: implement
  } catch (err) {
    if (err.message.match('Invalid token')) {
      return res.status(403).json({ error: err.message })
    }

    console.error(err)
    return res.status(400).json({ error: `Invalid request: ${err.message}`})
  }
})

router.get("/tokens", async function (req, res) {
  try {
    // We set a scope of `revoke-tokens` to prevent auth tokens from being able to revoke
    // tokens unless they have the `revoke-tokens` scope (which is intentionally impossible
    // as `revoke-toknes` scope is intentionally force removed from any requested scopes)
    const { context } = await Utils.getNetworkConnectionFromRequest(req, {
      scope: "access-tokens"
    })

    // @todo: implement
  } catch (err) {
    if (err.message.match('Invalid token')) {
      return res.status(403).json({ error: err.message })
    }

    console.error(err)
    return res.status(400).json({ error: `Invalid request: ${err.message}`})
  }
})

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
