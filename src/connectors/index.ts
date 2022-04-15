
export default function (connectorName: string): any {
    const connector = require(`./${connectorName}`)
    return new connector.default()
}