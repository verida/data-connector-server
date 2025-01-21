import { Request, Response } from "express";
import UsageManager from "../../../../services/usage/manager"

export class AppController {

    public async usage(req: Request, res: Response) {
        const { did } = req.veridaNetworkConnection
        
        return res.json({
            results: await UsageManager.getRequests(did)
        })
    }

}

const controller = new AppController()
export default controller