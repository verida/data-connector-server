import { LLM } from "../llm"

const systemPrompt = `You are an expert data analyst. When I give you a prompt, you must generate search metadata that will be used to extract relevant information to help answer the prompt.
You must generate a JSON response containing the following information:
- search_type: keywords (search for specific keywords), all (search with filters, no keywords required)
- keywords: array of single word terms to search on that match the underlying objective of the search. extract entity names. aim for 5-10 terms.
- timeframe: one of; day, week, month, quarter, half-year, full-year, all
- databases: an array of databases to search; emails, chat_messages, files, favourites, web_history, calendar
- sort: keyword_rank, recent, oldest
- output_type: The amount of detail in the output of each search result to provide meaningful context. full_content, summary, name
- profile_information; Array of these options only; name, contactInfo, demographics, lifestyle, preferences, habits, financial, health, personality, employment, education, skills, language, interests

JSON only, no explanation.`

export interface PromptSearchLLMResponse {
    search_type: "keywords" | "all";
    keywords?: string[]; // Array of single word terms, required if search_type is "keywords"
    timeframe: "day" | "week" | "month" | "quarter" | "half-year" | "full-year" | "all";
    databases: Array<"emails" | "chat_messages" | "files" | "favourites" | "web_history" | "calendar">;
    sort: "keyword_rank" | "recent" | "oldest";
    output_type: "full_content" | "summary" | "name";
    profile_information: Array<
      "name" | "contactInfo" | "demographics" | "lifestyle" | "preferences" | "habits" |
      "financial" | "health" | "personality" | "employment" | "education" | "skills" |
      "language" | "interests"
    >;
  }

export class PromptSearch {

    private llm: LLM

    constructor(llm: LLM) {
        this.llm = llm
    }

    public async search(userPrompt: string): Promise<PromptSearchLLMResponse> {
        const response = await this.llm.prompt(userPrompt, systemPrompt)
        console.log(response.choices[0])
        return <PromptSearchLLMResponse> JSON.parse(response.choices[0].message.content)
        
    }

}