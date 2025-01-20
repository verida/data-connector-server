import { Request, Response, NextFunction } from 'express';
import { NetworkConnectionRequestOptions, Utils } from '../utils';

export interface AuthMiddlewareConfig {
    sessionRequired?: boolean
    scopes?: string[]
    dbScope?: "r" | "w" | "d",
    dsScope?: "r" | "w" | "d",
    options?: NetworkConnectionRequestOptions
}

export default function AuthMiddleware(config: AuthMiddlewareConfig = {}) {

    return async function(req: Request, res: Response, next: NextFunction) {
        // Ensure we don't change config.scopes as that will retain scopes across multiple requests
        const scopes = config.scopes ? [...config.scopes] : []

        // Inject database scope from request params
        if (config.dbScope) {
            const dbName = req.params[0]
            scopes.push(`db:${config.dbScope}:${dbName}`)
        }

        // Inject datastore scope from request params
        if (config.dsScope) {
            const dsName = Utils.getSchemaFromParams(req.params.schema)
            scopes.push(`ds:${config.dsScope}:${dsName}`)
        }

        try {
            req.veridaNetworkConnection = await Utils.getNetworkConnectionFromRequest(req, {
                scopes,
                ...(config.options ? config.options : {})
            })

            // Ensure session is provided if required
            if (config.sessionRequired && !req.veridaNetworkConnection.sessionString) {
                throw new Error(`Session is required`)
            }
        } catch(err: any) {
            return res.status(403).json({ error: err.message })
        }
        
        next();
    }
}