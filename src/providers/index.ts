import CONFIG from "../config"
const _ = require('lodash')

export default function (providerName: string): any {
    const provider = require(`./${providerName}`)

    // @ts-ignore
    const providerConfig = _.merge(CONFIG.providerDefaults, CONFIG.providers[providerName])
    providerConfig.callbackUrl = `${CONFIG.serverUrl}/callback/${providerName}`

    return new provider.default(providerConfig)
}