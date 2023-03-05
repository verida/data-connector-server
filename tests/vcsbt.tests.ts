import Axios from 'axios'
const assert = require("assert")
import serverconfig from '../src/serverconfig.json'
import Providers from '../src/providers'
import CommonUtils from './common.utils'
import { Credentials, SharingCredential } from '@verida/verifiable-credentials'
import { DatabasePermissionOptionsEnum } from '@verida/types'
import { buildVeridaUri, fetchVeridaUri } from '@verida/helpers'

const SCHEMA_FOLLOWING = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'
const SCHEMA_SBT = 'https://common.schemas.verida.io/token/sbt/storage/v0.1.0/schema.json'
const MINT_ADDRESS = '0x2cEf1aF8510C158008fD69Ef233Bfff732E5C30A'

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = serverconfig.logLevel

const providerName = 'twitter'
const providerConfig = serverconfig.providers[providerName]
const creds = providerConfig.testing

let connection, followingDatastore, encryptionKey, credentialRecord

// NEXT steps:
// 1. Make VC creation optional
// 2. Cant Mint SBT
// 3. Test if new Twitter passport has fixed issue on my phone

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    describe("VC and SBT tests", () => {
        //let syncResult
        const provider = Providers(providerName)

        before(async () => {
            const provider = Providers(providerName)
            connection = await CommonUtils.getNetwork()
            // Open the "following" datastore
            followingDatastore = await connection.context.openDatastore(
                SCHEMA_FOLLOWING
            )

            const info = await (await followingDatastore.getDb()).info()
            encryptionKey = Buffer.from(info.encryptionKey).toString('hex')
            await CommonUtils.closeDatastore(followingDatastore)
        })

        it('can sync and obtain a VC', async() => {
            const syncRequestResult = await CommonUtils.syncConnector(providerName, creds.accessToken, creds.refreshToken, connection.did, encryptionKey)
            const { source, status, syncInfo } = await CommonUtils.getSyncResult(connection, syncRequestResult, encryptionKey)

            assert.ok(status != 'error', `Sync error: ${syncInfo.error}`)

            const credentials = new Credentials()
            credentialRecord = syncInfo.profile.credential
            const verifiedCredential = await credentials.verifyCredential(credentialRecord.didJwtVc)
            assert.ok(verifiedCredential, 'Have a verified credential')

            console.log(verifiedCredential)

            //assert.equal(verifiedCredential.payload.iss, connection.did, 'Correct DID')            
        })

        it('can generate a valid SBT', async () => {
            // Save the credentialRecord to public credential db
            const datastore = await connection.context.openDatastore(SCHEMA_SBT, {
                permissions: {
                    read: DatabasePermissionOptionsEnum.PUBLIC,
                    write: DatabasePermissionOptionsEnum.OWNER
                }
            });

            const sbtData = {
                ...credentialRecord.credentialData,
                didJwtVc: credentialRecord.didJwtVc
            }
            
            const result = await datastore.save(sbtData)
            console.log(result)
            assert.ok(result, 'Saved credential record')
            
            const db = await datastore.getDb()
            const info = await db.info()
            const uri = buildVeridaUri(connection.did, connection.context.getContextName(), info.databaseName, result.id, {})
            console.log(uri)
            await CommonUtils.mintSBT(uri, MINT_ADDRESS)

            // close database
        })

        // try to mint the same SBT again which will fail

        // revoke SBT

        after(async () => {
            // Delete SBT?
        })
    })
})