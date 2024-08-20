import { Request, Response } from "express";
import { LLMServices } from '../../../services/llm'
import { PromptService } from '../../../services/prompt'
import { Utils } from "../../../utils";
const _ = require('lodash')


const llm = LLMServices.bedrock

/**
 * 
 */
export class LLMController {

    public async prompt(req: Request, res: Response) {
        try {
            const prompt = req.body.prompt
            const serverResponse = await llm(prompt)

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

            const promptService = new PromptService(did, context)
            const promptResult = await promptService.personalPrompt(prompt)

            return res.json(promptResult)
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }
}

export const controller = new LLMController()