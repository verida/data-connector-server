const assert = require("assert")
import Axios from 'axios'
import { Network, EnvironmentType, Context } from '@verida/client-ts'
import { AutoAccount } from '@verida/account-node'

const SERVER_URL = 'http://localhost:5021'
const TEST_VAULT_CONTEXT = 'Verida: Fake Vault'
const TEST_VAULT_PRIVATE_KEY = '0x78d3b996ec98a9a536efdffbae40e5eaaf117765a587483c69195c9460165c37'
let TEST_VAULT_DID, context

const VERIDA_ENVIRONMENT = EnvironmentType.TESTNET
const VERIDA_TESTNET_DEFAULT_SERVER = 'https://db.testnet.verida.io:5002/'

const account = new AutoAccount({
    defaultDatabaseServer: {
        type: 'VeridaDatabase',
        endpointUri: VERIDA_TESTNET_DEFAULT_SERVER
    },
    defaultMessageServer: {
        type: 'VeridaMessage',
        endpointUri: VERIDA_TESTNET_DEFAULT_SERVER
    }
}, {
    privateKey: TEST_VAULT_PRIVATE_KEY, 
    environment: VERIDA_ENVIRONMENT
})

const SCHEMA_LIKES = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

// token must be manually fetched for now
// the account linked to this token must have
//  - At least 5 page likes
const accessToken = 'EAAP5ZANvAUzMBAPYqkvmGZCSk9WZBL2kMO34sTG2m0XXlLOEg83GZAvBvjDEZAKPOqYuMaE1OPXUTyDXHuBQ4zN01Vtdpp1jKA9z98JbZALSBMQKvssCL580n9QyWqOV8CTTOZCVqNVSr8wrZAr97mvfZAZAtGrL0W6vuiCi8coeN4rRIuTO33pJqK8Deo2rOpj1PgV5XXpjQU3aQJhabb5qw7pEeXjFlaHTJqreFa4K5eECIutyi3OLF8'
const axios = Axios.create()

describe("Facebook Tests", function() {
    this.timeout(100000)
    const nonce = 1

    describe("Sync", async () => {

        let syncResult
        it("Can sync", async () => {
            let did = TEST_VAULT_DID = await account.did()
            context = await Network.connect({
                context: {
                    name: TEST_VAULT_CONTEXT
                },
                client: {
                    environment: VERIDA_ENVIRONMENT
                },
                account
            })

            syncResult = await axios.get(`${SERVER_URL}/sync/facebook?accessToken=${accessToken}&did=${did}&nonce=${nonce}`)

            assert.ok(syncResult, 'Have a sync result')
            assert.ok(syncResult.data, 'Have sync result data')
            assert.equal(syncResult.data.did, did, 'Expected DID returned')
            assert.equal(syncResult.data.contextName, 'Verida: Data Connector', 'Have expected context name')
        })

        it("Has valid page likes", async () => {
            const { response, signerDid, contextName } = syncResult.data
            assert.ok(response[SCHEMA_LIKES], 'Have likes response data')

            const { databaseName, encryptionKey } = response[SCHEMA_LIKES]
            const key = Buffer.from(encryptionKey, 'hex')

            const externalDatastore = await context.openExternalDatastore(SCHEMA_LIKES, signerDid, {
                permissions: {
                    read: "users",
                    write: "users",
                    readList: [TEST_VAULT_DID],
                    writeList: [TEST_VAULT_DID]
                },
                encryptionKey: key,
                databaseName,
                contextName
            })

            const results = await externalDatastore.getMany()
            assert.equal(results.length >= 5, true, 'Have expected number of results')
            const db = await externalDatastore.getDb()
            await db._localDb.destroy()
        })
    })
})