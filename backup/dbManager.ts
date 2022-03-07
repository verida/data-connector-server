import Nano from 'nano'
import { DIDDocument } from 'did-resolver'
import { DbDIDDocument } from './interfaces'

export default class DbManager {

    static _couchDb: Nano.ServerScope

    /**
     * Save a DID Document to the database.
     * 
     * Update existing document if it exists.
     * 
     * @param {DIDDocument} doc 
     */
    public static async saveDoc(doc: DIDDocument): Promise<DbDIDDocument> {
        const couch = DbManager.getCouch()
        const db = couch.db.use(process.env.DB_DOC_NAME)

        doc.id = doc.id.toLowerCase()

        const data: DbDIDDocument = {
            _id: doc.id,
            doc: doc
        }

        // try to find the existing doc
        try {
            const existingDoc = await db.get(doc.id)

            if (existingDoc) {
                data._rev = existingDoc._rev
            }
        } catch (err) {
            // Document may not be found, so continue
            if (err.error != 'not_found') {
                // If an unknown error, then send to error log
                throw err
            }
        }

        /* @ts-ignore */
        const response: DbDIDDocument = await db.insert(data)

        return response
    }

    /**
     * Load a DID Document from the database
     * 
     * @param {string} did 
     */
    public static async loadDoc(did: string): Promise<DbDIDDocument> {
        const couch = DbManager.getCouch()
        const db = couch.db.use(process.env.DB_DOC_NAME)

        /* @ts-ignore */
        const doc: DbDIDDocument = await db.get(did)
        return doc
    }

    /**
     * Ensure the DID Document Database exists
     * 
     * (Executed on server startup)
     */
    public static async ensureDb(dbName: string) {
        const couch = DbManager.getCouch()
        
        try {
            await couch.db.create(dbName)
            console.log("Created database: " + dbName)
        } catch (err) {
            console.log("Database existed: " + dbName)
        }

        return true
    }

    /**
     * Instantiate a CouchDB instance
     */
    public static getCouch() {
        const dsn = DbManager.buildDsn(process.env.DB_USER, process.env.DB_PASS)

        if (!DbManager._couchDb) {
            DbManager._couchDb = Nano({
                url: dsn,
                requestDefaults: {
                    /* @ts-ignore */
                    rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED_SSL.toLowerCase() != "false"
                }
            })
        }

        return DbManager._couchDb
    }

    public static buildDsn(username: string, password: string) {
        let env = process.env
        return env.DB_PROTOCOL + "://" + username + ":" + password + "@" + env.DB_HOST + ":" + env.DB_PORT
    }

}