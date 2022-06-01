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
    testing: {
        encryptionKey: ''
    },
    providers: {
        facebook: {
            appId: '',
            appSecret: '',
            followingLimit: 20,
            postLimit: 20,
            testing: {
                accessToken: ''
            }
        },
        twitter: {
            apiKey: '',
            apiSecret: '',
            bearerToken: '',
            followingLimit: 20,
            postLimit: 20,
            testing: {
                accessToken: '',
                refreshToken: ''
            }
        }
    },
    providerDefaults: {
        limitResults: true
    }
}