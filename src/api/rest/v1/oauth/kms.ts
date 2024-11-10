import { Network } from "@verida/client-ts";
import EncryptionUtils from "@verida/encryption-utils";
import { DatabasePermissionOptionsEnum, IContext, IDatabase } from "@verida/types";

const API_KEY_SESSION_LENGTH = 48
const KEY_DB = 'api_keys'

export interface VeridaSession extends Object {}

export interface KeyMaterial {
    _id?: string
    keyMaterial: string
}

export interface Scope {
    type: "schema" | "endpoint"
}

export interface SchemaScope extends Scope {
    schemaUri: string
    access: "read" | "write"
    filter?: object
}

export interface EndpointScope extends Scope {
    endpoint: string
}

export interface ApiDetails {
    session: VeridaSession
    scopes: Scope[]
}

/**
 * Key Management Service
 */
export class KMS {

    /**
     * Key is made up of:
     * 
     * - 
     * @param veridaSession 
     */
    public static async generateApiKey(veridaSession: VeridaSession, requestingDid: string, scopes: Scope[]): Promise<string> {
        const context = await KMS.getContextFromSession(veridaSession)
        const did = await context.getAccount().did()
        
        // base64 encode the session object as a string
        const b64ApiDetails = EncryptionUtils.encodeBase64(JSON.stringify(<ApiDetails> {
            session: veridaSession,
            scopes
        }))
        
        // split the b64 session string into two parts, with the last part 48 bytes long
        const part1 = b64ApiDetails.substring(0, b64ApiDetails.length - API_KEY_SESSION_LENGTH)
        const part2 = b64ApiDetails.substring(b64ApiDetails.length - API_KEY_SESSION_LENGTH)

        // base64 encode the dids
        const b64Did = EncryptionUtils.encodeBase64(did)

        // base64 encode the requesting DID
        const b64RequestingDid = EncryptionUtils.encodeBase64(requestingDid)

        // build the key material
        const keyMaterial = `${b64RequestingDid}:${part1}`

        // generate encryption key
        const key = EncryptionUtils.randomKey(32)
        const b64Key = EncryptionUtils.encodeBase64(key.toString())

        // encrypt the key material
        const encryptedKeyMaterial = EncryptionUtils.symEncrypt(keyMaterial, key)
        
        // save the encrypted key material
        const apiKeyId = await KMS.saveKeyMaterial(context, encryptedKeyMaterial)

        // build the API key
        const apiKey = `${apiKeyId}:${part2}:${b64Key}`
        
        return apiKey
    }

    public static async revokeApiKey(context: IContext, keyId: string): Promise<void> {
        const keyDb = await KMS.getKeyDb(context)

        try {
            const keyRecord = await keyDb.get(keyId)
            await keyDb.delete(keyRecord)
        } catch (err: any) {
            throw new Error(`API key doesn't exist, expired or revoked`)
        }
    }

    public static async saveKeyMaterial(context: IContext, keyMaterial: string): Promise<string> {
        const keyData: KeyMaterial = {
            keyMaterial
        }

        const keyDb = await KMS.getKeyDb(context)

        const success = await keyDb.save(keyData)
        if (!success) {
            // @ts-ignore
            throw new Error(`Unable to save key material to API database: ${keyDb.errors}`)
        }

        return success.id
    }

    public static async getDetailsFromApiKey(ownerDid: string, requestingDid: string, apiKey: string): Promise<ApiDetails> {
        const keyParts = apiKey.split(':')
        const keyId = keyParts[0]
        const part2 = keyParts[1]
        const b64key = keyParts[2]

        const veridaUri = `verida://${ownerDid}/Verida: Vault/${KEY_DB}/${keyId}`
        const keyMaterialRecord = <KeyMaterial> await Network.getRecord(veridaUri)

        const encryptedKeyMaterial = keyMaterialRecord.keyMaterial

        const encryptionKey = EncryptionUtils.decodeBase64(b64key)
        // const keyMaterial = `${b64RequestingDid}:${part1}`
        const keyMaterial = EncryptionUtils.symDecrypt(encryptedKeyMaterial, Buffer.from(encryptionKey))

        const keyMaterialParts = keyMaterial.split(':')
        const b64RequestingDid = keyMaterialParts[0]
        const part1 = keyMaterialParts[1]

        const keyMaterialRequestingDid = EncryptionUtils.decodeBase64(b64RequestingDid).toString()

        if (requestingDid != keyMaterialRequestingDid) {
            throw new Error(`Requesting DID doesn't match API key`)
        }

        const b64ApiDetails = `${part1}${part2}`
        const apiDetails: ApiDetails = JSON.parse(EncryptionUtils.decodeBase64(b64ApiDetails).toString())

        return apiDetails
    }

    public static async getContextFromSession(veridaSession: VeridaSession): Promise<IContext> {
    }

    public static async getKeyDb(context: IContext): Promise<IDatabase> {
        const keyDb = await context.openDatabase(KEY_DB, {
            permissions: {
                read: DatabasePermissionOptionsEnum.PUBLIC,
                write: DatabasePermissionOptionsEnum.OWNER
            }
        })

        return keyDb
    }
    
}