import { Command } from 'command-line-interface';
import { ConnectProviderOptions } from './interfaces';
import { AutoAccount } from '@verida/account-node';
import { Network } from '@verida/types';
import open from 'open'

import serverconfig from '../../config'
import { COMMAND_PARAMS } from '../utils';

// const DID_CLIENT_CONFIG = serverconfig.verida.didClientConfig

export const Connect: Command<ConnectProviderOptions> = {
    name: 'Connect',
    description: `Connect to a third party data provider and save the credentials into the Verida: Vault context`,
    optionDefinitions: [
      COMMAND_PARAMS.provider,
      COMMAND_PARAMS.key,
      COMMAND_PARAMS.network
    ],
    async handle ({ options }) {
      console.log(`Connecting to ${options.provider} on network ${options.network}.`);

      if (!options.key) {
        console.log(`No key specified from command line or environment variable`)
        return
      }

      // Initialize Account
      const account = new AutoAccount({
        privateKey: options.key,
        network: <Network> options.network,
        didClientConfig: {
          callType: 'web3',
          web3Config: {
            // Set a dummy private key as we shouldn't need to create a DID automatically
            // The sending DID should already exist
            privateKey: '0x0000000000000000000000000000000000000000000000000000000000000000'
          }
        }
      })

      const did = (await account.did()).toLowerCase()
      console.log(`Verida Account has DID: ${did}`)

      // @todo: Switch to context account once context storage node issue fixed and deployed
      //const consentMessage = `Do you wish to unlock this storage context: "Verida: Vault"?\n\n${did}`
      //const signature = await account.sign(consentMessage)
      const signature = options.key

      /*const keyring = await account.keyring('Verida: Vault')

      const account2 = new ContextAccount({
        privateKey: signature,
        environment: EnvironmentType.MAINNET,
        // @ts-ignore
        didClientConfig: DID_CLIENT_CONFIG
    }, did, 'Verida: Vault')
      const keyring2 = await account2.keyring('Verida: Vault')
      console.log(keyring)
      console.log(keyring2)

      const network = new Client({
        environment: EnvironmentType.MAINNET
      })
      await network.connect(account2)
      const context = await network.openContext('Verida: Vault')
      const ds = await context.openDatastore('https://vault.schemas.verida.io/data-connections/connection/v0.1.0/schema.json')
      const rows = await ds.getMany()
      console.log(rows)*/

      const openUrl = `${serverconfig.serverUrl}/api/${serverconfig.apiVersion}/connect/${options.provider}?key=${signature}`
      open(openUrl)
    }
  };