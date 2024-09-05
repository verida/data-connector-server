import { Connection } from "../interfaces"
import CONFIG from "../config"
import BaseProvider from "./BaseProvider"
import { IContext } from "@verida/types"
const _ = require('lodash')

export default function (providerName: string, vault?: IContext, connection?: Connection): BaseProvider {
    const provider = require(`./${providerName}`)

    // @ts-ignore
    const providerConfig = _.merge({}, CONFIG.providerDefaults, CONFIG.providers[providerName])
    providerConfig.callbackUrl = `${CONFIG.serverUrl}/callback/${providerName}`

    return new provider.default(providerConfig, vault, connection)
}