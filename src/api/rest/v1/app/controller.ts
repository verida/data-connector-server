import { Request, Response } from "express";
import UsageManager from "../../../../services/usage/manager"
import BillingManager from "../../../../services/billing/manager"
import Alchemy from "../../../../services/billing/alchemy"
import { BillingTxnType } from "../../../../services/billing/interfaces";
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
            return res.status(500).send({
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