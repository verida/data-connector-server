import { Request, Response } from "express";
import { bedrock } from '../../../services/llm'
import { PromptSearchService } from '../../../services/assistants/search'
import { Utils } from "../../../utils";
import { HotLoadProgress } from "../../../services/data";
import { DataService } from "../../../services/data";
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

    /**
     * Hotload the data necessary to power the AI search capabilities
     * 
     * @param req 
     * @param res 
     */
    public async hotLoad(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkFromRequest(req)
            const did = await account.did()
            const data = new DataService(did, context)

            data.on('progress', (progress: HotLoadProgress) => {
                res.write(`data: ${JSON.stringify(progress)}\n\n`)
            })

            // Set-up event source response
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders()
            // Tell the client to retry every 10 seconds if connectivity is lost
            res.write('retry: 10000\n\n')

            await data.hotLoad()
            res.end()
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }
}

export const controller = new LLMController()