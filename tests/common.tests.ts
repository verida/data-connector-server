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

        // close database
        const db = await externalDatastore.getDb()
        await db._localDb.close()
    }

}