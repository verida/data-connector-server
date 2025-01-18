import { Request, Response, NextFunction } from 'express';
import { Utils } from '../utils';

export interface AuthMiddlewareConfig {
    sessionRequired?: boolean
    scopes?: string[]
    dbScope?: "r" | "w" | "d",
    dsScope?: "r" | "w" | "d",
}

export default function AuthMiddleware(config: AuthMiddlewareConfig = {}) {

    return async function(req: Request, res: Response, next: NextFunction) {
        console.log('Middleware is running')

        // Inject database scope from request params
        if (config.dbScope) {
            const dbName = req.params[0]
            config.scopes.push(`db:${config.dbScope}:${dbName}`)
        }

        // Inject datastore scope from request params
        if (config.dsScope) {
            const dsName = Utils.getSchemaFromParams(req.params[0])
            config.scopes.push(`ds:${config.dsScope}:${dsName}`)
        }

        try {
            req.veridaNetworkConnection = await Utils.getNetworkConnectionFromRequest(req, {
                scopes: config.scopes
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