import { Request, Response } from "express";
import UsageManager from "../../../../services/usage/manager"

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
            stats: await UsageManager.getUsageStats(did, startDateTime, endDateTime)
        })
    }

}

const controller = new AppController()
export default controller