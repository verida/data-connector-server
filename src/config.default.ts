import { EnvironmentType } from '@verida/client-ts'

export default {
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
            callbackUrl: ''
        }
    }
    

}