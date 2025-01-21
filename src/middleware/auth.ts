import { Request, Response, NextFunction } from 'express';
import { NetworkConnectionRequestOptions, Utils } from '../utils';
import UsageManager from "../services/usage/manager"
import { UsageRequest } from '../services/usage/interfaces';

export interface AuthMiddlewareConfig {
    sessionRequired?: boolean
    scopes?: string[]
    dbScope?: "r" | "w" | "d",
    dsScope?: "r" | "w" | "d",
    options?: NetworkConnectionRequestOptions
}

export default function AuthMiddleware(config: AuthMiddlewareConfig = {}) {
    return async function(req: Request, res: Response, next: NextFunction) {
        const start = Date.now(); // Record start time

        // Ensure we don't change config.scopes as that will retain scopes across multiple requests
        const scopes = config.scopes ? [...config.scopes] : []

        // Inject database scope from request params
        if (config.dbScope) {
            const dbName = req.params.database
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
            // do we log this?
            return res.status(403).json({ error: err.message })
        }

        // Store the original `send` method to capture the response body
        const originalSend = res.send;

        // Override the `send` method to capture the response content length
        res.send = function (body: any): Response {
            const duration = Date.now() - start; // Calculate latency

            let responseLength = 0
            if (body) {
                const output = (typeof body == "string" ? body : JSON.stringify(body))
                responseLength = body ? Buffer.byteLength(output, 'utf8') : 0; // Calculate the response length in characters
            }

            if (req.veridaNetworkConnection.appDID) {
                const request: UsageRequest = {
                    appDID: req.veridaNetworkConnection.appDID ? req.veridaNetworkConnection.appDID : undefined,
                    userDID: req.veridaNetworkConnection.did,
                    path: req.originalUrl,
                    resultSize: responseLength,
                    latency: duration,
                }

                try {
                    const responseJSON = JSON.parse(body)

                    if (responseJSON.finalPrompt) {
                        request.tokens = {
                            input: responseJSON.finalPrompt.input_tokens,
                            output: responseJSON.finalPrompt.output_tokens,
                            total: responseJSON.finalPrompt.total_tokens
                      }
                    }
                } catch (err) {
                    // Not JSON response, so ignore
                }

                UsageManager.logRequest(request)
            }

            // Call the original send method to send the response
            return originalSend.call(this, body);
        };
        
        next();
    }
}