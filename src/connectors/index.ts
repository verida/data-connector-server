
export default function (connectorName: string, connectorConfig: object = {}): any {
    const connector = require(`./${connectorName}`)
    return new connector.default(connectorConfig)
}