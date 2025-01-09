import { Request, Response } from "express";
import { Utils } from "../../../../utils";
import { AuthClient } from "./client";
import AuthServer from "./server";
import { AuthUser } from "./user";
import { AuthToken } from "./interfaces";

export class AuthController {

    public async auth(req: Request, res: Response) {
        const { context, sessionString } = await Utils.getNetworkConnectionFromRequest(req)
        const { client_id, auth_request, redirect_uri, user_sig, state } = req.body;

        if (!sessionString) {
            return res.status(400).json({ error: "Invalid user session key"});
        }

        if (!client_id) {
            return res.status(400).json({ error: "Invalid client or redirect URI" });
        }

        const client = new AuthClient(client_id.toString())
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
            const authUser = new AuthUser(context)
            const authToken = await AuthServer.generateAuthToken(authRequest, authUser, sessionString)

            // Redirect the user to the third party application with a valid auth_code that can
            // be used to retrieve access and refresh tokens.
            return res.redirect(`${redirect_uri}?auth_token=${encodeURIComponent(authToken)}&state=${state}`);
        } catch (err) {
            return res.status(400).json({ error: `Invalid auth request: ${err.message}`})
        }
    }

    public async checkScope(req: Request, res: Response) {
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
    }

    public async tokens(req: Request, res: Response) {
        try {
            // We set a scope of `revoke-tokens` to prevent auth tokens from being able to revoke
            // tokens unless they have the `revoke-tokens` scope (which is intentionally impossible
            // as `revoke-toknes` scope is intentionally force removed from any requested scopes)
            const { context } = await Utils.getNetworkConnectionFromRequest(req, {
              scope: "access-tokens"
            })
        
            const authUser = new AuthUser(context)
            const tokens = await authUser.getAuthTokens()
            return res.json({
              tokens
            })
        
            // @todo: implement
          } catch (err) {
            if (err.message.match('Invalid token')) {
              return res.status(403).json({ error: err.message })
            }
        
            console.error(err)
            return res.status(400).json({ error: `Invalid request: ${err.message}`})
          }
    }

    public async token(req: Request, res: Response) {
        try {
            const { context, tokenId } = await Utils.getNetworkConnectionFromRequest(req)
        
            const authUser = new AuthUser(context)
            const authToken: AuthToken = await authUser.getAuthToken(tokenId)
        
            res.json({ token: authToken });
          } catch (err) {
            if (err.message.match('Invalid token')) {
              return res.status(403).json({ error: err.message })
            }
        
            console.error(err)
            return res.status(400).json({ error: `Invalid request: ${err.message}`})
          }
    }

    public async revoke(req: Request, res: Response) {
        const tokenId = req.query.tokenId.toString()

        try {
            // We set a scope of `revoke-tokens` to prevent auth tokens from being able to revoke
            // tokens unless they have the `revoke-tokens` scope (which is intentionally impossible
            // as `revoke-toknes` scope is intentionally force removed from any requested scopes)
            const { context } = await Utils.getNetworkConnectionFromRequest(req, {
            scope: "access-tokens"
            })

            const authUser = new AuthUser(context)
            await AuthServer.revokeToken(authUser, tokenId)
            res.send({ revoked: true });
        } catch (err) {
            if (err.message.match('Invalid token')) {
            return res.status(403).json({ error: err.message })
            }

            console.error(err)
            return res.status(400).json({ error: `Invalid request: ${err.message}`})
        }
    }

}

export const controller = new AuthController()