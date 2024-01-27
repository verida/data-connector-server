const mcache = require("memory-cache")
import { DIDClient } from '@verida/did-client'
import { VERIDA_ENVIRONMENT } from './utils'

let didClient: DIDClient

export default class RequestValidator {

    /**
     * Allow access to any user who provides a valid signed message for the given application
     * 
     * @todo: cache the signature verifications
     * 
     * @param {*} did 
     * @param {*} password 
     * @param {*} req 
     */
    public authorize(did: string, signature: string, req: any, cb: any) {
        did = did.replace(/_/g, ":").toLowerCase()
        const storageContext = req.headers['context-name']
        const cacheKey = `${did}/${storageContext}`

        const authCheck = async () => {
            try {
                let didDocument = mcache.get(cacheKey)
                const consentMessage = `Access the "generic" service using context: "${storageContext}"?\n\n${did}`

                console.log("Verifying message", consentMessage)

                if (!didDocument) {
                    if (!didClient) {
                        didClient = new DIDClient({
                            network: VERIDA_ENVIRONMENT
                        })
                    }

                    didDocument = await didClient.get(did)

                    if (!didDocument) {
                        cb(null, false)
                        return
                    }

                    if (didDocument) {
                        const { DID_CACHE_DURATION }  = process.env
                        mcache.put(cacheKey, didDocument, parseInt(DID_CACHE_DURATION) * 1000)
                    }
                }

                const result = didDocument.verifyContextSignature(consentMessage, storageContext, signature)

                console.log('result', result)

                if (!result) {
                    cb(null, false)
                } else {
                    cb(null, true)
                }
            } catch (err) {
                // @todo: Log error
                // Likely unable to resolve DID
                console.error(err)
                cb(null, false)
            }
        }

        const promise = new Promise((resolve: any, rejects) => {
            authCheck()
            resolve()
        })
    }

    public getUnauthorizedResponse(req: Request) {
        return {
            status: "fail",
            code: 0,
            data: {
                "auth": "Invalid credentials supplied"
            }
        }
    }

}