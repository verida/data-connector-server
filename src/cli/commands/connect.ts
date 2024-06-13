import { Command } from 'command-line-interface';
import { ConnectProvider } from './interfaces';
import { AutoAccount } from '@verida/account-node';
import { EnvironmentType } from '@verida/types';
import CONFIG from '../../config'

export const ConnectProviderCommand: Command<ConnectProvider> = {
    name: 'ConnectProvider',
    description: `Connect to a third party data provider and save the credentials into the Verida: Vault context`,
    optionDefinitions: [
      {
        name: 'provider',
        description: 'Unique ID of the provider',
        type: 'string',
        alias: 'p',
        isRequired: true
      },
      {
        name: 'key',
        description: 'Verida network private key (or seed phrase)',
        type: 'string',
        defaultValue: process.env.privateVeridaKey,
        alias: 'k'
      },
      {
        name: 'network',
        description: 'Verida network (testnet, mainnet)',
        type: 'string',
        alias: 'n',
        defaultValue: 'mainnet',
        validate(val: string) {
          const valid = ['testnet', 'mainnet']
          if (valid.indexOf(val) === -1) {
            return false
          }
        }
      },
    ],
    async handle ({ options }) {
      console.log(`Connecting to ${options.provider} on network ${options.network}.`);

      // Initialize Account
      const account = new AutoAccount({
        privateKey: options.key,
        environment: <EnvironmentType> options.network,
        didClientConfig: {
          callType: 'web3',
          web3Config: {
            // Set a dummy private key as we shouldn't need to create a DID automatically
            // The sending DID should already exist
            privateKey: CONFIG.verida.testPrivateVeridaKey
          }
        }
      })

      const did = await account.did()
      console.log(`Verida Account has DID: ${did}`)

      open(`${CONFIG.serverUrl}/connect/${options.provider}`)

      //const keyring = await account.keyring('Verida: Vault')
    }
  };