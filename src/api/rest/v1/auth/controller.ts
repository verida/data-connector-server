import { Request, Response } from "express";
import { Utils } from "../../../../utils";
import { AuthClient } from "./client";
import AuthServer from "./server";
import { AuthUser } from "./user";
import { AuthToken, ScopeType } from "./interfaces";
import SCOPES, { DATABASE_LOOKUP, DATASTORE_LOOKUP, expandScopes, isKnownSchema } from "./scopes"
import axios from "axios";

type ResolvedScopePermission = ("r" | "w" | "d")

interface ResolvedScope {
    type?: ScopeType
    name?: string
    permissions?: ResolvedScopePermission[],
    description?: string
    uri?: string
    knownSchema?: boolean
}

const SCHEMA_CACHE: Record<string, {
    description: string,
    title: string
}> = {}

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

            return res.json({
                redirectUrl: `${redirect_uri}?auth_token=${encodeURIComponent(authToken)}&state=${state}`
            })
        } catch (err) {
            console.log(err)
            return res.status(400).json({ error: `Invalid auth request: ${err.message}`})
        }
    }

    public async checkScope(req: Request, res: Response) {
        const scope = req.query.scope.toString()

        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req, {
                scopes: [scope]
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

    /**
     * Get all the available tokens for the current user.
     * 
     * Permission is denied for scoped Auth Tokens.
     * 
     * @param req 
     * @param res 
     * @returns 
     */
    public async tokens(req: Request, res: Response) {
        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)
        
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

    /**
     * Get the details for an auth token
     * 
     * @param req 
     * @param res 
     * @returns 
     */
    public async token(req: Request, res: Response) {
        try {
            // Fake inject the token from the query params into the headers so it can be used in Utils
            const authToken = decodeURIComponent(req.query.tokenId.toString())
            req.headers.authorization = `Bearer ${authToken}`

            const { context, tokenId } = await Utils.getNetworkConnectionFromRequest(req, { ignoreScopeCheck: true })
        
            const authUser = new AuthUser(context)
            const authTokenObj: AuthToken = await authUser.getAuthToken(tokenId)

            res.json({ token: authTokenObj });
          } catch (err) {
            if (err.message.match('Invalid token')) {
              return res.status(403).json({ error: err.message })
            }
        
            console.error(err)
            return res.status(400).json({ error: `Invalid request: ${err.message}`})
          }
    }

    /**
     * Revoke an auth token
     * 
     * @param req 
     * @param res 
     * @returns 
     */
    public async revoke(req: Request, res: Response) {
        const tokenId = req.query.tokenId.toString()

        try {
            const { context } = await Utils.getNetworkConnectionFromRequest(req)

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

    /**
     * Create a new auth token, not linked to a third party application
     * 
     * @param req 
     * @param res 
     * @returns 
     */
    public async createToken(req: Request, res: Response) {
        try {
            const scopes = req.body.scopes
            const { context, sessionString } = await Utils.getNetworkConnectionFromRequest(req)

            const authUser = new AuthUser(context)
            const userDID = await context.getAccount().did()
            const authToken = await AuthServer.createAuthToken({
                session: sessionString,
                scopes,
                userDID
            }, authUser, sessionString)

            res.send({ token: authToken });
        } catch (err) {
            console.error(err)
            return res.status(400).json({ error: `Invalid request: ${err.message}`})
        }
    }

    public async scopes(req: Request, res: Response) {
        res.send({ scopes: SCOPES });
    }

    public async resolveScopes(req: Request, res: Response) {
        let scopes = <string[]> req.query.scopes

        if (!Array.isArray(scopes)) {
            scopes = [scopes]
        }

        // Expand scopes
        const resolvedScopes = expandScopes(scopes, false)

        // Add user data
        const finalScopes: ResolvedScope[] = []
        for (const scope of resolvedScopes) {
            const scopeParts = scope.split(":")
            const scopeType = <ScopeType> scopeParts[0]

            switch (scopeType) {
                case ScopeType.API:
                    if (!SCOPES[scope]) {
                        // ignore invalid API scopes
                        break
                    }

                    finalScopes.push({
                        type: scopeType,
                        name: scopeParts[1],
                        description: SCOPES[scope].userNote
                    })
                    break
                case ScopeType.DATABASE:
                    const scopePermissions = scopeParts[1]
                    const permissions: ResolvedScopePermission[] = []
                    for (const p of scopePermissions) {
                        permissions.push(<ResolvedScopePermission> p)
                    }

                    finalScopes.push({
                        type: scopeType,
                        name: scopeParts[2],
                        permissions,
                        description: DATABASE_LOOKUP[`db:${scopeParts[2]}`]?.description
                    })
                    break
                case ScopeType.DATASTORE:
                    const scopePermissions1 = scopeParts[1]
                    const permissions1: ResolvedScopePermission[] = []
                    for (const p of scopePermissions1) {
                        permissions1.push(<ResolvedScopePermission> p)
                    }

                    scopeParts.splice(0,2)
                    const schemaUrl = scopeParts.join(":")

                    if (!SCHEMA_CACHE[schemaUrl]) {
                        try {
                            const response = await axios.get(schemaUrl)
                            SCHEMA_CACHE[schemaUrl] = {
                                description: response.data.description,
                                title: response.data.title
                            }
                        } catch (err: any) {
                            SCHEMA_CACHE[schemaUrl] = {
                                description: `Schema not found`,
                                title: `Unknown`
                            }
                        }
                    }

                    const schemaTitle = SCHEMA_CACHE[schemaUrl].title
                    const schemaDescription = SCHEMA_CACHE[schemaUrl].description

                    finalScopes.push({
                        type: scopeType,
                        permissions: permissions1,
                        description: schemaDescription,
                        name: schemaTitle,
                        uri: schemaUrl,
                        knownSchema: isKnownSchema(schemaUrl)
                    })
                    break
            }
        }

        res.send({ scopes: finalScopes });
    }

}

export const controller = new AuthController()