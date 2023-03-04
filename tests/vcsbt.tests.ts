import Axios from 'axios'
const assert = require("assert")
import serverconfig from '../src/serverconfig.json'
import Providers from '../src/providers'
import CommonUtils from './common.utils'
import { Credentials } from '@verida/verifiable-credentials'

const SCHEMA_FOLLOWING = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = serverconfig.logLevel

const providerName = 'twitter'
const providerConfig = serverconfig.providers[providerName]
const creds = providerConfig.testing

let connection, followingDatastore, encryptionKey, credential

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

        it('can sync without obtaining a VC', async() => {
            const syncRequestResult = await CommonUtils.syncConnector(providerName, creds.accessToken, creds.refreshToken, connection.did, encryptionKey)
            const { source, status, syncInfo } = await CommonUtils.getSyncResult(connection, syncRequestResult, encryptionKey)
            console.log(syncInfo)
            console.log(syncInfo.profile.credential)

            const credentials = new Credentials()
            const credentialData = syncInfo.profile.credential
            const verifiedCredential = await credentials.verifyCredential(syncInfo.profile.credential.didJwtVc)
            console.log('verifiedCredential')
            console.log(verifiedCredential)
        })

        it('can sync and obtain a VC', async() => {

        })

        it('can generate a valid VC', async () => {

        })

        it('can generate a valid SBT', async () => {

        })

        after(async () => {
            // Delete SBT?
        })
    })
})