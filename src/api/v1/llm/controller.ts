import { Request, Response } from "express";
import Axios from 'axios'
import { stripHtml } from "string-strip-html"
import { LLMServices } from './services'
const _ = require('lodash')

const defaultModel = 'llama3'
// const luceneUri = 'http://127.0.0.1:5022/search/ds/aHR0cHM6Ly9jb21tb24uc2NoZW1hcy52ZXJpZGEuaW8vc29jaWFsL2VtYWlsL3YwLjEuMC9zY2hlbWEuanNvbg==='
// const quickSearchUri = 'http://127.0.0.1:5022/quicksearch/ds/aHR0cHM6Ly9jb21tb24uc2NoZW1hcy52ZXJpZGEuaW8vc29jaWFsL2VtYWlsL3YwLjEuMC9zY2hlbWEuanNvbg==='
const miniSearchUrl = 'http://127.0.0.1:5022/minisearch/ds/aHR0cHM6Ly9jb21tb24uc2NoZW1hcy52ZXJpZGEuaW8vc29jaWFsL2VtYWlsL3YwLjEuMC9zY2hlbWEuanNvbg==='
const MAX_EMAIL_LENGTH = 1000
const MAX_ATTACHMENT_LENGTH = 1000
// const SNIPPET_EMAIL_LENGTH = 500
const MAX_CONTEXT_LENGTH = 20000

const llmServices = new LLMServices()

const llm = llmServices.bedrock

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
        const start = Date.now()
        try {
            const prompt = req.body.prompt
            const model = req.body.model ? req.body.model : defaultModel
            const key = req.body.key

            console.log(req.body)

            // Get queries that can help answer the prompt
            //const queryPrompt = `Generate 10 lucene search queries, include reasonable synonyms, to find relevant emails to help respond to this prompt:\n${prompt}\nYou have the following searchable fields: subject,messageText,fromName,fromEmail.\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
            const keywordPrompt = `Generate 10 individual words that could help search for relevant emails realated to this prompt:\n${prompt}\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
            const keywordResponse = await llm(keywordPrompt)
            const entityPrompt = `Extract any individual or organization names mentioned in this prompt:\n${prompt}\nYour response must only contain a single JSON list of search strings, no other commentary and no formatting.`
            const entityResponse = await llm(entityPrompt)

            console.log(keywordResponse)
            console.log(entityResponse)
            const keywords = JSON.parse(keywordResponse)
            let entities = []
            try {
                entities = JSON.parse(entityResponse)
            } catch (err) {
                // do nothing
            }

            console.log(keywords)
            console.log(entities)

            // let searchString = ``
            // if (entities.length) {
            //     searchString = `name:(${entities.join(' OR ')}) OR fromEmail:(${entities.join(' OR ')}) OR fromName:(${entities.join(' OR ')}) OR messageText:(${entities.join(' OR ')})`
            // }
            // if (keywords.length) {
            //     searchString += ` OR name:(${keywords.join(' OR ')}) OR messageText:(${keywords.join(' OR ')}) `
            // }

            // console.log(searchString)
            // const fields = 'name:10,fromName,fromEmail,messageText'

            // const responses = []
            // try {
            //     responses.push(await Axios.get(`${luceneUri}?q=${searchString}`, {
            //         headers: {
            //             key
            //         }
            //     }))
            // } catch (err) {
            //     console.log('Error: ', err.message)
            // }

            const responses = []
            const searchFields = `name,fromName,fromEmail,messageText,attachments_0.textContent,attachments_1.textContent,attachments_2.textContent`
            try {
                // for (let searchAttribute of keywords.concat(entities)) {
                    responses.push(await Axios.get(`${miniSearchUrl}?q=${keywords.concat(entities).join(' ')}&fields=${searchFields}`, {
                        headers: {
                            key
                        }
                    }))
                // }
            } catch (err) {
                console.log('Error: ', err.message)
            }

            // Merge results into a single list of emails (removes duplicates) and sum scores across all searches
            const emailRows: Record<string, any> = {}
            for (let response of responses) {
                for (let row of response.data.results) {
                    if (row.messageText == 'No email body' || !row.messageText) {
                        continue
                    }

                    console.log(row.id, row.fromName, row.name, row.score)

                    if (!emailRows[row.id]) {
                        emailRows[row.id] = {
                            id: row.id,
                            _score: 0
                        }
                    }

                    emailRows[row.id] = {
                        ...emailRows[row.id],
                        fromName: row.fromName,
                        fromEmail: row.fromEmail,
                        subject: row.name,
                        sentAt: row.sentAt,
                        attachments: row.attachments,
                        body: stripHtml(row.messageText).result.substring(0, MAX_EMAIL_LENGTH),
                        _score: emailRows[row.id]._score * 2 + row.score
                    }
                }
            }

            const foundEmails = Object.values(emailRows).length
            console.log(`Have ${foundEmails} emails`)
            if (foundEmails == 0) {
                return res.json({
                    results: []
                })
            }

            // Sort by score
            let emails = Object.values(emailRows)

            // const emailSnippets: Record<string, any> = {}
            // for (let emailId in emails) {
            //     const email = emails[emailId]

            //     emailSnippets[emailId] = {
            //         id: email.id,
            //         fromName: email.fromName,
            //         fromEmail: email.fromEmail,
            //         subject: email.subject,
            //         //body: stripHtml(email.body).result.substring(0, SNIPPET_EMAIL_LENGTH)
            //     }

            //     //console.log(emailId, email.fromEmail, email.subject)
            // }

            // const stagingPrompt = `This is a JSON object containing recent emails that may help answer this prompt\n${prompt}Please remove the irrelevant emails and retain the relevant ones.\n${JSON.stringify(Object.values(emailSnippets))}. Your response must only be a single JSON list of email IDs, with no extra commentary.`
            // console.log('Running staging prompt', stagingPrompt.length)
            // const stagingGroqResponse = await llm.groq(stagingPrompt)
            // const stagingResponse = JSON.parse(stagingGroqResponse.replace(/[^\[]*/, '').replace(/[^\]]*$/, ''))

            // console.log(stagingGroqResponse)
            // console.log(stagingResponse)

            // console.log('priority emails are', stagingResponse)
            // for (let i in stagingResponse) {
            //     const row: any = stagingResponse[i]
            //     const id = typeof(row) == 'object' ? row.id : row
            //     console.log(id)
            //     emails[id]._score = emails[id]._score*5 + 0.5
            // }

            emails.sort((a: any, b: any) => b._score - a._score)

            // Only include top 20 emails
            emails = emails.slice(0, 20)
            // for (let e of emails) {
            //     console.log(e.id, e.fromName, e.subject, e._score)
            // }

            // const emailIds = JSON.parse(stagingResponse)
            let finalPrompt = `Answer this prompt:\n${prompt}\nHere are some recent emails that may help you provide a relevant answer.\n`
            let contextString = ''
            for (const email of emails) {
                // if (typeof(emailId) == 'object') {
                //     emailId = emailId.id
                // }

                // const email = emails[emailId]
                // if (!email) {
                //     console.log(emailId, 'not found')
                //     continue
                // }
                // console.log('Match: ', email.fromName, email.subject)
                let body = email.body.substring(0, MAX_EMAIL_LENGTH)
                if (email.attachments) {
                    for (const attachment of email.attachments) {
                        body += attachment.textContent.substring(0, MAX_ATTACHMENT_LENGTH)
                    }
                }

                const extraContext = `${email.fromName} <${email.fromEmail}> (${email.name})\n${body}\n\n`
                if ((extraContext.length + contextString.length + finalPrompt.length) > MAX_CONTEXT_LENGTH) {
                    break
                }
                
                contextString += extraContext
            }

            finalPrompt += contextString
            //console.log('Running final prompt', finalPrompt.length)
            const finalResponse = await llm(finalPrompt)
            const duration = Date.now() - start

            return res.json({
                result: finalResponse,
                duration,
                keywords,
                entities
                // stagingPrompt,
                // stagingResponse,
                //finalPrompt
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error.message);
        }
    }

    protected async runQuery() {

    }
}

export const controller = new LLMController()


// "You are. a personal assistant with the ability to search the following categories; emails, chat_history and documents. You receive a prompt and generate a JSON response (with no other text) that provides search queries that will source useful information to help answer the prompt. Search queries for each category should contain three properties; \"terms\" (an array of 10 individual words), \"beforeDate\" (results must be before this date), \"afterDate\" (results must be after this date), \"resultType\" (either \"count\" to count results or \"results\" to return the search results), \"filter\" (an array of key, value pairs of fields to filter the results). Categories can be empty if not relevant to the prompt. The current date is 2024-08-12.\n\nHere is an example JSON response:\n{\"email\": {\"terms\": [\"golf\", \"tennis\", \"soccer\"], \"beforeDate\": \"2024-06-01\", \"afterDate\": \"2024-01-10\" \"filter\": {\"from\": \"dave\"}, \"resultType\": \"results}}\n\nHere is the prompt:\nWhat subscriptions do I currently pay for?"