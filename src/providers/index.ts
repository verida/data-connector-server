import { Connection } from "../interfaces"
import CONFIG from "../config"
import BaseProvider from "./BaseProvider"
import { IContext } from "@verida/types"
const _ = require('lodash')

export default function (providerId: string, vault?: IContext, connection?: Connection): BaseProvider {
    try {
        const provider = require(`./${providerId}`)

        // @ts-ignore
        const providerConfig = _.merge({}, CONFIG.providerDefaults, CONFIG.providers[providerId])
        providerConfig.callbackUrl = `${CONFIG.serverUrl}/callback/${providerId}`

        return new provider.default(providerConfig, vault, connection)
    } catch (err) {
        console.error(`${providerId} not found`)
        throw new Error(`${providerId} not found`)
    }
}