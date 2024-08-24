import { Request, Response } from "express";
import { bedrock } from '../../../services/llm'
import { PromptSearchService } from '../../../services/assistants/search'
import { Utils } from "../../../utils";
const _ = require('lodash')


const llm = bedrock

/**
 * 
 */
export class LLMController {

    public async prompt(req: Request, res: Response) {
        try {
            const prompt = req.body.prompt
            const serverResponse = await llm.prompt(prompt)

            return res.json({
                result: serverResponse
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    public async personalPrompt(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()
            const prompt = req.body.prompt

            const promptService = new PromptSearchService(did, context)
            const promptResult = await promptService.prompt(prompt)

            return res.json(promptResult)
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }
}

export const controller = new LLMController()