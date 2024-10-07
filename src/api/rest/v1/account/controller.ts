import { Request, Response } from "express";
import { Utils } from "../../../../utils";

/**
 * 
 */
export class AccountController {
    
    public async fromKey(req: Request, res: Response) {
        try {
            const networkInstance = await Utils.getNetworkFromRequest(req)
            const profile = await networkInstance.context.openProfile()

            const result: any = {
                did: networkInstance.did
            }

            if (profile) {
                result.account = await profile.getMany({},{})
            }

            return res.send({
                success: true,
                ...result
            })
        } catch (err: any) {
            console.log(err)
            return res.status(401).send({
                success: false,
                message: err.message
            })
        }
    }
}

export const controller = new AccountController()