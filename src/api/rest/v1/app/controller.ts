import { Request, Response } from "express";
import UsageManager from "../../../../services/usage/manager"
import BillingManager from "../../../../services/billing/manager"
import Alchemy from "../../../../services/billing/alchemy"
import { BillingTxnType } from "../../../../services/billing/interfaces";

export class AppController {

    public async requests(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection
        
        return res.json({
            results: await UsageManager.getRequests(did)
        })
    }

    public async accountCount(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection
        
        return res.json({
            count: await UsageManager.getAccountCount(did)
        })
    }

    public async usage(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection
        const startDateTime = req.params.start ? req.params.start.toString() : undefined
        const endDateTime = req.params.end ? req.params.end.toString() : undefined
        
        return res.json({
            usage: await UsageManager.getUsageStats(did, startDateTime, endDateTime)
        })
    }

    public async balance(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection
        
        return res.json({
            balance: await BillingManager.getBalance(did)
        })
    }

    public async deposits(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection
        
        return res.json({
            deposits: await BillingManager.getDeposits(did)
        })
    }

    public async depositCrypto(req: Request, res: Response) {
        const { did, network } = req.veridaNetworkConnection
        const { txnId, fromAddress, amount, signature } = req.body
        const didDocument = await network.didClient.get(did)

        try {
            await BillingManager.verifyCryptoDeposit(didDocument, txnId, fromAddress, amount, signature)

            const tokenPrice = await Alchemy.getVDAPrice()
            const depositAmount = parseFloat(tokenPrice.toString())

            const credits = parseFloat((amount / depositAmount).toString())

            await BillingManager.deposit({
                did,
                txnId,
                credits: parseFloat(credits.toString()),
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