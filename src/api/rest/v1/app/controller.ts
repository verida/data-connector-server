import { Request, Response } from "express";
import UsageManager from "../../../../services/usage/manager"
import BillingManager from "../../../../services/billing/manager"
import AlchemyManager from "../../../../services/billing/alchemy"
import Alchemy from "../../../../services/billing/alchemy"
import { BillingAccountType, BillingTxnType } from "../../../../services/billing/interfaces";
import { Utils } from "alchemy-sdk";

function bigintReplacer(key: string, value: any) {
    if (typeof value === 'bigint') {
      return value.toString(); // Convert BigInt to string
    }
    return value;
  }

function serialize(data: any): string {
    return JSON.parse(JSON.stringify(data, bigintReplacer))
}

export class AppController {
    // TODO: Gracefully handle errors

    public async getAccount(req: Request, res: Response) {
        try {
            const { did } = req.veridaNetworkConnection

            const account = await BillingManager.getAccount(did)

            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: "Account not found"
                })
            }

            return res.json({
                success: true,
                account
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({
                success: false,
                error: "Something went wrong while retrieving account"
            })
        }
    }

    public async register(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection

        return res.json({
            success: await BillingManager.registerAccount(did, BillingAccountType.APP)
        })
    }

    public async requests(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection

        return res.json({
            results: await UsageManager.getRequests(did)
        })
    }

    public async accountCount(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection

        return res.json(serialize({
            count: await UsageManager.getAccountCount(did)
        }))
    }

    public async usage(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection
        const startDateTime = req.params.start ? req.params.start.toString() : undefined
        const endDateTime = req.params.end ? req.params.end.toString() : undefined

        return res.json(serialize({
            usage: await UsageManager.getUsageStats(did, startDateTime, endDateTime)
        }))
    }

    public async balance(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection

        const balance = await BillingManager.getBalance(did)
        return res.json(serialize({
            balance
        }))
    }

    public async vdaPrice(req: Request, res: Response) {
        const vdaPrice = await AlchemyManager.getVDAPrice()
        return res.json({
            price: vdaPrice
        })
    }

    public async deposits(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection

        return res.json(serialize({
            deposits: await BillingManager.getDeposits(did)
        }))
    }

    public async depositCrypto(req: Request, res: Response) {
        if (!BillingManager.isEnabled) {
            return res.status(500).send({
                "error": "Billing is disabled"
            })
        }

        const { did, network } = req.veridaNetworkConnection
        const { txnId, fromAddress, amount, signature } = req.body
        const didDocument = await network.didClient.get(did)

        try {
            await BillingManager.verifyCryptoDeposit(didDocument, txnId, fromAddress, amount, signature)


            await BillingManager.deposit({
                did,
                txnId,
                tokens: Utils.parseUnits(amount.toString(), 18).toString(),
                description: 'Account deposit',
                txnType: BillingTxnType.CRYPTO
            })
        } catch (err) {
            return res.status(400).send({
                "error": err.message
            })
        }

        return res.json({
            success: true
        })
    }


}

const controller = new AppController()
export default controller
