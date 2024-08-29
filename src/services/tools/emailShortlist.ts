import { KeywordSearchTimeframe } from "../../helpers/interfaces";
import { SchemaEmail } from "../../schemas";
import { LLM } from "../llm"
import { SearchType } from "../search";

const systemPrompt = `You are an expert data analyst. I will provide you with a prompt and a list of email IDs and subjects.
You must generate a JSON object containing a single key "emailIds" that contains an array of emailIds that are the most relevant to helping answer the prompt.
Data is in the format:
[emailId] <emailSubject>

JSON only, no explanation.`

const MAX_EMAILS = 200


export class EmailShortlist {

    private llm: LLM

    constructor(llm: LLM) {
        this.llm = llm
    }

    public async shortlist(originalPrompt: string, emails: SchemaEmail[], limit=20): Promise<SchemaEmail[]> {
        console.log("shortlist")
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
        console.log(response.choices[0])
        const jsonResponse: any = JSON.parse(response.choices[0].message.content!)
        console.log(jsonResponse)
        const emailIds = jsonResponse.emailIds
        console.log(emailIds)
        const result: SchemaEmail[] = []

        for (const emailId of emailIds) {
            result.push(emailDict[emailId])
            console.log(emailDict[emailId].name)
            limit--
            if (limit <= 0) {
                break
            }
        }

        return result
        
    }

}