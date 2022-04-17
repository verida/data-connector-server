import { EnvironmentType } from '@verida/client-ts'

export default {
    serverUrl: 'http://localhost:5021',
    logLevel: "debug", // trace, debug, info, warn, error, fatal
    verida: {
        environment: EnvironmentType.TESTNET,
        contextName: 'Verida: Data Connector',
        privateKey: '',
        defaultEndpoints: {
            defaultDatabaseServer: {
                type: 'VeridaDatabase',
                endpointUri: 'https://db.testnet.verida.io:5002/'
            },
            defaultMessageServer: {
                type: 'VeridaMessage',
                endpointUri: 'https://db.testnet.verida.io:5002/'
            },
        },
    },
    connectors: {
        facebook: {
            appId: '',
            appSecret: '',
            testing: {
                accessToken: ''
            }
        },
        twitter: {
            apiKey: '',
            apiSecret: '',
            bearerToken: '',
            testing: {
                accessToken: '',
                refreshToken: ''
            }
        }
    },
    connectorDefaults: {
        limitResults: true
    }
    

}