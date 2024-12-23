import { KeywordSearchTimeframe } from "../../helpers/interfaces";
import { SchemaEmail } from "../../schemas";
import { LLM } from "../llm"
import { SearchType } from "../search";

const systemPrompt = `You are an expert data analyst. I will provide you with a prompt and a list of email IDs and subjects.
You must generate a JSON object containing a single key "emailIds" that contains an array of emailIds that are the most relevant to helping answer the prompt.
Data is in the format:
[emailId] <emailSubject>

JSON only, no explanation, no formatting.`

const MAX_EMAILS = 200


export class EmailShortlist {

    private llm: LLM

    constructor(llm: LLM) {
        this.llm = llm
    }

    public async shortlist(originalPrompt: string, emails: SchemaEmail[], limit=20): Promise<SchemaEmail[]> {
        let userPrompt = `${originalPrompt}\n\n`
        const emailDict: Record<string, SchemaEmail> = {}
        let emailLimit = MAX_EMAILS
        for (const email of emails) {
            emailDict[email._id] = email
            userPrompt += `[${email._id}] <${email.name}>\n`
            emailLimit--
            if (emailLimit <= 0) {
                break
            }
        }

        userPrompt += `\nMaximum of ${limit} email IDs`
        const response = await this.llm.prompt(userPrompt, systemPrompt)
        const jsonResponse: any = JSON.parse(response.textResponse)
        const emailIds = jsonResponse.emailIds
        const result: SchemaEmail[] = []

        for (const emailId of emailIds) {
            if (!emailDict[emailId]) {
                continue
            }

            result.push(emailDict[emailId])
            limit--
            if (limit <= 0) {
                break
            }
        }

        return result
        
    }

}