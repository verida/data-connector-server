import { Request, Response } from "express";
import { LLMProviders, ProviderModels, prompt as LLMPrompt, OpenAIConfig, getLLM } from '../../../../services/llm'
import { PromptSearchService } from '../../../../services/assistants/search'
import { Utils } from "../../../../utils";
import { HotLoadProgress } from "../../../../services/data";
import { DataService } from "../../../../services/data";
import { PromptSearchServiceConfig } from "../../../../services/assistants/interfaces";
const _ = require('lodash')

export interface LLMConfig {
    llmProvider: LLMProviders,
    llmModel: string,
    customEndpoint?: OpenAIConfig
}

function buildLLMConfig(req: Request) {
    const provider = req.body.provider ? req.body.provider.toString() : LLMProviders.BEDROCK.toString()
    if (!Object.values(LLMProviders).includes(provider)) {
        throw new Error(`${provider} is not a valid LLM provider`)
    }
    const llmProvider = <LLMProviders> provider

    let customEndpoint: OpenAIConfig
    let llmModel: string
    if (llmProvider == LLMProviders.CUSTOM) {
        const endpoint = req.body.customEndpoint.toString()
        const key = req.body.customKey ? req.body.customKey.toString() : undefined
        customEndpoint = {
            endpoint,
            key
        }

        llmModel = req.body.model.toString()
    } else {
        const model = req.body.model ? req.body.model.toString() : "LLAMA3_70B"
        if (!Object.keys(ProviderModels[llmProvider]).includes(model)) {
            throw new Error(`${model} is not a valid model for ${provider}`)
        }

        // @ts-ignore
        llmModel = ProviderModels[llmProvider][model]
    }

    return {
        customEndpoint,
        llmModel,
        llmProvider
    }
}

/**
 *
 */
export class LLMController {

    public async prompt(req: Request, res: Response) {
        try {
            const {
                customEndpoint,
                llmModel,
                llmProvider
            } = buildLLMConfig(req)

            const prompt = req.body.prompt.toString()
            const systemPrompt = req.body.systemPrompt ? req.body.systemPrompt.toString() : undefined
            const jsonFormat = req.body.jsonFormat ? req.body.jsonFormat.toString() === "true" : false
            const serverResponse = await LLMPrompt(prompt, systemPrompt, jsonFormat, llmProvider, llmModel, customEndpoint ? customEndpoint : undefined)

            return res.json({
                result: serverResponse
            })
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    public async profilePrompt(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkConnectionFromRequest(req)
            const did = await account.did()

            const schema = req.body.schema
            const prompt = `Analyse my data to populate a JSON object that matches this schema.\n\n${schema}`
            const promptConfig: PromptSearchServiceConfig = req.body.promptConfig ? req.body.promptConfig : {}
            promptConfig.jsonFormat = true

            const {
                customEndpoint,
                llmModel,
                llmProvider
            } = buildLLMConfig(req)

            const llm = getLLM(llmProvider, llmModel, customEndpoint)

            const promptService = new PromptSearchService(did, context)
            const promptResult = await promptService.prompt(prompt, llm, promptConfig)

            promptResult.result = JSON.parse(promptResult.result)

            return res.json(promptResult)
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    public async personalPrompt(req: Request, res: Response) {
        try {
            const { context, account } = await Utils.getNetworkConnectionFromRequest(req)
            const did = await account.did()
            const prompt = req.body.prompt
            const promptConfig: PromptSearchServiceConfig = req.body.promptConfig

            const {
                customEndpoint,
                llmModel,
                llmProvider
            } = buildLLMConfig(req)

            const llm = getLLM(llmProvider, llmModel, customEndpoint)

            const promptService = new PromptSearchService(did, context)
            const promptResult = await promptService.prompt(prompt, llm, promptConfig)

            return res.json(promptResult)
        } catch (error) {
            console.log(error)
            res.status(500).send({
                success: false,
                error: error.message
            });
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
            const { context, account } = await Utils.getNetworkConnectionFromRequest(req)
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
            res.write(`data: ${JSON.stringify({
                success: false,
                error: error.message
            })}\n\n`)
            res.end()
        }
    }
}

export const controller = new LLMController()
