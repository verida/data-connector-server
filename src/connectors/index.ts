import CONFIG from "../config"
const _ = require('lodash')

export default function (connectorName: string): any {
    const connector = require(`./${connectorName}`)

    // @ts-ignore
    const connectorConfig = _.merge(CONFIG.connectorDefaults, CONFIG.connectors[connectorName])
    connectorConfig.callbackUrl = `${CONFIG.serverUrl}/callback/${connectorName}`

    return new connector.default(connectorConfig)
}