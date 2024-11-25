import { Request, Response } from "express";
import { prompt as LLMPrompt, OpenAIConfig, getLLM } from '../../../../services/llm'
import { PromptSearchService } from '../../../../services/assistants/search'
import { Utils } from "../../../../utils";
import { HotLoadProgress } from "../../../../services/data";
import { DataService } from "../../../../services/data";
import { PromptSearchServiceConfig } from "../../../../services/assistants/interfaces";
import { PromptSearch } from "../../../../services/tools/promptSearch";
import { LLMProvider, ProviderModels } from "../../../../services/llmmodels";
import CONFIG from "../../../../config"
const _ = require('lodash')

const DEFAULT_LLM_MODEL = CONFIG.verida.llms.defaultModel
const DEFAULT_LLM_PROVIDER = CONFIG.verida.llms.defaultProvider

export interface LLMConfig {
    llmProvider: LLMProvider,
    llmModel: string,
    customEndpoint?: OpenAIConfig
}

function buildLLMConfig(req: Request): {
    customEndpoint: OpenAIConfig
    llmModelId: string
    llmProvider: LLMProvider
    llmTokenLimit?: number
} {
    const provider = req.body.provider ? req.body.provider.toString() : DEFAULT_LLM_PROVIDER
    if (!Object.values(LLMProvider).includes(provider)) {
        throw new Error(`${provider} is not a valid LLM provider`)
    }
    const llmProvider = <LLMProvider> provider

    let customEndpoint: OpenAIConfig
    let llmModelId: string
    if (llmProvider == LLMProvider.CUSTOM) {
        const endpoint = req.body.customEndpoint.toString()
        const key = req.body.customKey ? req.body.customKey.toString() : undefined
        const noSystemPrompt = req.body.customNoSystemPrompt ? req.body.customNoSystemPrompt.toString() == "true" : false
        customEndpoint = {
            endpoint,
            noSystemPrompt,
            key
        }

        llmModelId = req.body.model.toString()
    } else {
        llmModelId = req.body.model ? req.body.model.toString() : DEFAULT_LLM_MODEL

        if (!Object.keys(ProviderModels[llmProvider]).includes(llmModelId)) {
            throw new Error(`${llmModelId} is not a valid model for ${provider}`)
        }
    }

    const llmTokenLimit = req.body.tokenLimit ? parseInt(req.body.tokenLimit.toString()) : undefined

    return {
        customEndpoint,
        llmModelId,
        llmProvider,
        llmTokenLimit
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
                llmModelId,
                llmProvider,
                llmTokenLimit
            } = buildLLMConfig(req)

            const prompt = req.body.prompt.toString()
            const systemPrompt = req.body.systemPrompt ? req.body.systemPrompt.toString() : undefined
            const jsonFormat = req.body.jsonFormat ? req.body.jsonFormat.toString() === "true" : false
            const serverResponse = await LLMPrompt(prompt, systemPrompt, jsonFormat, llmProvider, llmModelId, llmTokenLimit, customEndpoint ? customEndpoint : undefined)

            return res.json({
                result: serverResponse
            })
        } catch (error) {
            console.error(error)
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
            const promptSearchTip = req.body.promptSearchTip
            const outputSystemPrompt = req.body.systemPrompt || false

            const {
                customEndpoint,
                llmModelId,
                llmProvider,
                llmTokenLimit
            } = buildLLMConfig(req)

            const llm = getLLM(llmProvider, llmModelId, llmTokenLimit, customEndpoint)

            let promptSearchResult = undefined
            if (promptSearchTip) {
                const promptSearch = new PromptSearch(llm)
                promptSearchResult = await promptSearch.search(promptSearchTip)
            }

            const prompt = `Analyse my data to populate a JSON object that matches this schema.\n\n${schema}`
            const promptConfig: PromptSearchServiceConfig = req.body.promptConfig ? req.body.promptConfig : {}
            promptConfig.jsonFormat = true
            promptConfig.promptSearchConfig = promptSearchResult

            const promptService = new PromptSearchService(did, context)
            const promptResult = await promptService.prompt(prompt, llm, promptConfig)

            if (!outputSystemPrompt) {
                promptResult.systemPrompt = undefined
            }

            promptResult.result = JSON.parse(promptResult.result)

            promptResult.llm = {
                provider: llmProvider,
                model: llmModelId
            }

            return res.json(promptResult)
        } catch (error) {
            console.error(error)
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
            let promptConfig: PromptSearchServiceConfig = req.body.promptConfig
            promptConfig = _.merge({
                jsonFormat: false
            }, promptConfig ? promptConfig : {})

            const {
                customEndpoint,
                llmModelId,
                llmProvider,
                llmTokenLimit
            } = buildLLMConfig(req)

            const llm = getLLM(llmProvider, llmModelId, llmTokenLimit, customEndpoint)

            const promptService = new PromptSearchService(did, context)
            const promptResult = await promptService.prompt(prompt, llm, promptConfig)

            promptResult.llm = {
                provider: llmProvider,
                model: llmModelId
            }

            return res.json(promptResult)
        } catch (error) {
            console.error(error)
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
            console.error(error)
            res.write(`data: ${JSON.stringify({
                success: false,
                error: error.message
            })}\n\n`)
            res.end()
        }
    }
}

export const controller = new LLMController()
