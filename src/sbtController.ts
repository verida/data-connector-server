import { AutoAccount } from '@verida/account-node'
import { Request, Response } from 'express'
import { VeridaSBTClient, SBTClientConfig } from "@verida/vda-sbt-client"
import { Utils, WHITELIST_SBT_ISSUERS, VERIDA_ENVIRONMENT, CONTEXT_NAME, DID_CLIENT_CONFIG } from './utils'
import { Credentials } from '@verida/verifiable-credentials'
import { fetchVeridaUri, explodeVeridaUri, wrapUri } from '@verida/helpers'
import { Context } from '@verida/client-ts'
import { DIDClient } from '@verida/did-client'
import { Web3CallType } from '@verida/types'

const SCHEMA_SBT_CREDENTIAL = 'https://common.schemas.verida.io/token/sbt/credential/v0.1.0/schema.json'

export default class SbtController {

    public static async mintSbt(req: Request, res: Response) {
        // verify issuer is this server's DID

        // @ts-ignore
        const { credentialUri } = req.body
        if (!credentialUri) {
            return res.status(400).send({
                status: "fail",
                message: `'credentialUri' is required`
            })
        }

        const { mintAddress } = req.body
        if (!mintAddress) {
            return res.status(400).send({
                status: "fail",
                message: `'mintAddress' is required`
            })
        }

        // Fetch credential record from the network
        const networkInfo = await Utils.getNetwork()
        const context = <Context> networkInfo.context
        const credentialRecord = await fetchVeridaUri(credentialUri, context)

        // Generate URL to mint that generates the metadata
        const sbtUri = wrapUri(credentialUri)

        const credentials = new Credentials()
        try {
            //const sbtClient = await SbtController.getSbtClient()
            const generatedCredential = await credentials.verifyCredential(credentialRecord.didJwtVc, {})
            const sbtData = generatedCredential.verifiableCredential.credentialSubject
            const proofs = generatedCredential.payload.vc.proofs
            const vcIssuerDid = generatedCredential.payload.iss

            // Verify the DIDJWTVC is a valid SBT credential issued by a whitelisted DID
            await SbtController.verifyDidJwtVc(generatedCredential, WHITELIST_SBT_ISSUERS, sbtData.did)

            // Get the context proof of the issuer
            // (Links their DID to the signing key of the context that signed the credential proof)
            const didClient = new DIDClient({
                network: VERIDA_ENVIRONMENT
            })
            const issuerDidDoc = await didClient.get(vcIssuerDid)
            const issuerContextProof = issuerDidDoc.locateContextProof(generatedCredential.payload.vc.veridaContextName)

            // Initiate a SBT claim on-chain
            const sbtClient = await SbtController.getSbtClient()

            await sbtClient.claimSBT(sbtData.type, sbtData.uniqueAttribute, sbtUri, mintAddress, proofs['type-unique-didAddress'], issuerContextProof)

            return res.status(200).send({
                status: "success",
                data: {
                    transactionId: '123'
                }
            })
        } catch (err: any) {
            console.log(err)
            return res.status(400).send({
                status: "fail",
                message: err.message
            })
        }
    }

    private static async verifyDidJwtVc(generatedCredential: any, issuerDids: string[], subjectDid: string) {
        // Verify credential signed by this issuer
        const verifiableCredential = generatedCredential.verifiableCredential

        let issuerFound = false
        issuerDids.forEach((issuerDid) => {
            if (verifiableCredential.vc.issuer.toLowerCase() == issuerDid.toLowerCase()) {
                issuerFound = true
            }
        })
        if (!issuerFound) {
            throw new Error('Untrusted credential signer')
        }

        // Verify subject DID is the one hosting the credential
        if (verifiableCredential.vc.sub.toLowerCase() != subjectDid.toLowerCase()) {
            throw new Error('Credential not published to the network by credential subject')
        }

        if (verifiableCredential.credentialSchema.id != SCHEMA_SBT_CREDENTIAL) {
            throw new Error('Invalid credential schema')
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
            callType: <Web3CallType> DID_CLIENT_CONFIG.callType,
            identifier: didAddress,
            signKey: `0x${Buffer.from(keys.signPrivateKey).toString('hex')}`,
            chainNameOrId: VERIDA_ENVIRONMENT,
            web3Options: DID_CLIENT_CONFIG.web3Config
        }

        return new VeridaSBTClient(config)
    }



}