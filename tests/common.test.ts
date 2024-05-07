const assert = require("assert")
import CommonUtils from "./common.utils"

export default class CommonTests {

    static async syncHasValidSchemaData(syncResult: any, connection: any, schemaUri: string, minCount: 5) {
        // Fetch and verify we have schema data
        const { response, signerDid, contextName } = syncResult.data
        assert.ok(response[schemaUri], 'Have valid response data')

        // Open external datastore
        const { databaseName, encryptionKey } = response[schemaUri]
        const externalDatastore = await CommonUtils.openSchema(connection.context, contextName, schemaUri, databaseName, encryptionKey, signerDid, connection.did)

        // Verify results
        const results = await externalDatastore.getMany()
        assert.equal(results.length >= minCount, true, 'Have expected number of results')

        // destroy local database to cleanup disk space
        const db = await externalDatastore.getDb()
        await db._localDbEncrypted.destroy()
    }

    static async hasValidSyncResult(syncResult: any, connection: any) {
        assert.ok(syncResult, 'Have a sync result')
        assert.ok(syncResult.data, 'Have sync result data')
        assert.equal(syncResult.data.did, connection.did, 'Expected DID returned')
        assert.equal(syncResult.data.contextName, 'Verida: Data Connector', 'Have expected context name')
    }

}