const _ = require('lodash')
import { KeywordSearchTimeframe } from "../../helpers/interfaces";
import { PromptSearchLLMResponseOptional } from "../assistants/interfaces";
import { LLM } from "../llm"
import { SearchType } from "../search";

const systemPrompt = `You are an expert data analyst. When I give you a prompt, you must generate search metadata that will be used to extract relevant information to help answer the prompt.
You must generate a JSON response containing the following information:
- search_type: keywords (search for specific keywords), all (search with filters, no keywords required)
- keywords: array of single word terms to search on that match the underlying objective of the search. extract entity names. aim for 5-10 terms.
- timeframe: one of; day, week, month, quarter, half-year, full-year, all
- databases: an array of databases to search; emails, messages, files, favorites, followed_pages, web_history, calendar
- sort: keyword_rank, recent, oldest
- output_type: The amount of detail in the output of each search result to provide meaningful context. full_content, summary, headline
- profile_information; Array of these options only; name, contactInfo, demographics, lifestyle, preferences, habits, financial, health, personality, employment, education, skills, language, interests

Output JSON only with no explanation or formatting.`

export enum PromptSearchType {
  KEYWORDS = "keywords",
  ALL = "all"
}

export enum PromptSearchSort {
  KEYWORD_RANK = "keyword_rank",
  RECENT = "recent",
  OLDEST = "oldest"
}

export enum PromptSearchOutputType {
  FULL = "full_content",
  SUMMARY = "summary",
  HEADLINE = "headline"
}

export interface PromptSearchLLMResponse {
    search_type: PromptSearchType;
    keywords?: string[]; // Array of single word terms, required if search_type is "keywords"
    timeframe: KeywordSearchTimeframe;
    databases: Array<SearchType>;
    sort: PromptSearchSort;
    output_type: PromptSearchOutputType;
    profile_information: Array<
      "name" | "contactInfo" | "demographics" | "lifestyle" | "preferences" | "habits" |
      "financial" | "health" | "personality" | "employment" | "education" | "skills" |
      "language" | "interests"
    >;
    search_summary?: string
}

export class PromptSearch {

    private llm: LLM

    constructor(llm: LLM) {
        this.llm = llm
    }

    public async search(userPrompt: string, retries = 3, defaultResponse?: PromptSearchLLMResponseOptional): Promise<PromptSearchLLMResponse> {
        const response = await this.llm.prompt(userPrompt, systemPrompt)

        try {
          const searchResponse = <PromptSearchLLMResponse> JSON.parse(response.choices[0].message.content!)
          return _.merge({}, searchResponse, defaultResponse ? defaultResponse : {})
        } catch (err: any) {
          if (retries === 0) {
            throw new Error(`No user data query available`)
          } else {
            this.search(userPrompt, retries--)
          }
        }
        
    }

}