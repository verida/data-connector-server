import { Request, Response } from "express";
import Axios from 'axios'
import { stripHtml } from "string-strip-html"
import { LLMServices } from '../../../services/llm'
import { PromptService } from '../../../services/prompt'
import { Utils } from "../../../utils";
const _ = require('lodash')

const defaultModel = 'llama3'
// const luceneUri = 'http://127.0.0.1:5022/search/ds/aHR0cHM6Ly9jb21tb24uc2NoZW1hcy52ZXJpZGEuaW8vc29jaWFsL2VtYWlsL3YwLjEuMC9zY2hlbWEuanNvbg==='
// const quickSearchUri = 'http://127.0.0.1:5022/quicksearch/ds/aHR0cHM6Ly9jb21tb24uc2NoZW1hcy52ZXJpZGEuaW8vc29jaWFsL2VtYWlsL3YwLjEuMC9zY2hlbWEuanNvbg==='
const miniSearchUrl = 'http://127.0.0.1:5022/minisearch/ds/aHR0cHM6Ly9jb21tb24uc2NoZW1hcy52ZXJpZGEuaW8vc29jaWFsL2VtYWlsL3YwLjEuMC9zY2hlbWEuanNvbg==='
const MAX_EMAIL_LENGTH = 1000
const MAX_ATTACHMENT_LENGTH = 1000
// const SNIPPET_EMAIL_LENGTH = 500
const MAX_CONTEXT_LENGTH = 20000


const llm = LLMServices.bedrock

/**
 * 
 */
export class LLMController {

    public async prompt(req: Request, res: Response) {
        try {
            const prompt = req.body.prompt
            const model = req.body.model ? req.body.model : defaultModel

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


// "You are a personal assistant with the ability to search the following categories; emails, chat_history and documents. You receive a prompt and generate a JSON response (with no other text) that provides search queries that will source useful information to help answer the prompt. Search queries for each category should contain three properties; \"terms\" (an array of 10 individual words), \"beforeDate\" (results must be before this date), \"afterDate\" (results must be after this date), \"resultType\" (either \"count\" to count results or \"results\" to return the search results), \"filter\" (an array of key, value pairs of fields to filter the results). Categories can be empty if not relevant to the prompt. The current date is 2024-08-12.\n\nHere is an example JSON response:\n{\"email\": {\"terms\": [\"golf\", \"tennis\", \"soccer\"], \"beforeDate\": \"2024-06-01\", \"afterDate\": \"2024-01-10\" \"filter\": {\"from\": \"dave\"}, \"resultType\": \"results}}\n\nHere is the prompt:\nWhat subscriptions do I currently pay for?"