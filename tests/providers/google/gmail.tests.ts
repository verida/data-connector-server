const assert = require("assert")
import { Connection } from '../../../src/interfaces'
import Providers from '../../../src/providers'
import CommonUtils, { NetworkInstance } from '../../common.utils'

import Gmail from '../../../src/providers/google/gmail'
import BaseProvider from '../../../src/providers/BaseProvider'
import { CommonTests, GenericTestConfig } from '../../common.tests'

const providerName = 'google'
let network: NetworkInstance
let connection: Connection
let provider: BaseProvider

describe(`${providerName} Tests`, function() {
    this.timeout(100000)

    this.beforeAll(async function() {
        network = await CommonUtils.getNetwork()
        connection = await CommonUtils.getConnection(providerName)
        provider = Providers(providerName, network.context, connection)
    })

    describe(`Fetch ${providerName} data`, () => {
        const handlerName = 'gmail'

        it(`Can fetch ${handlerName}`, async () => {
            const testConfig: GenericTestConfig = {
                idPrefix: "gmail",
                timeOrderAttribute: "sentAt",
                batchSizeLimitAttribute: "batchSize"
            }
            const providerConfig = {}

            await CommonTests.runGenericTests(providerName, Gmail, testConfig, providerConfig)
        })
    })

    this.afterAll(async function() {
        const { context } = await CommonUtils.getNetwork()
        await context.close()
    })
})