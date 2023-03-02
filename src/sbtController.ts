import { AutoAccount } from '@verida/account-node'
import { Request, Response } from 'express'
import { VeridaSBTClient, SBTClientConfig } from "@verida/vda-sbt-client"
import { Utils, PRIVATE_KEY, VERIDA_ENVIRONMENT, CONTEXT_NAME, DID_CLIENT_CONFIG } from './utils'
import { Credentials } from '@verida/verifiable-credentials'

export default class SbtController {

    public static async mintSbt(req: Request, res: Response) {
        // @ts-ignore
        const { didJwtVc } = req.body
        const credentials = new Credentials();
        try {
            const sbtClient = await SbtController.getSbtClient()
            const generatedCredential = await credentials.verifyCredential(didJwtVc, {})
            console.log(generatedCredential)
            //sbtClient.claimSBT()
        } catch (err: any) {
            return res.status(500).send({
                status: "fail",
                message: err.message
            })
        }
    }

    private static async getSbtClient(): Promise<VeridaSBTClient> {
        const networkInfo = await Utils.getNetwork()
        const account = <AutoAccount> networkInfo.account
        const keyring = await account.keyring(CONTEXT_NAME)
        const keys = await keyring.getKeys()
        const did = await account.did()
        const didAddress = did.match(/(0x.*)/)[0]

        const config: SBTClientConfig = {
            callType: 'web3',
            identifier: didAddress,
            signKey: keys.signPrivateKey,
            chainNameOrId: VERIDA_ENVIRONMENT,
            web3Options: DID_CLIENT_CONFIG.web3Config
        }

        return new VeridaSBTClient(config)
    }



}