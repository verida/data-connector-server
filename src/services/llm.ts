import Groq from "groq-sdk"
import Axios from 'axios'
import CONFIG from "../config"

export enum LLMProviders {
  BEDROCK = "bedrock",
  GROQ = "groq",
  CUSTOM = "custom"
}

export const ProviderModels = {
  [LLMProviders.BEDROCK]: {
    "LLAMA3_70B": "meta.llama3-70b-instruct-v1:0",
    "LLAMA3_8B": "meta.llama3-8b-instruct-v1:0",
    "MIXTRAL_8_7B": "mistral.mixtral-8x7b-instruct-v0:1"
  },
  [LLMProviders.GROQ]: {
    "LLAMA3_70B": "llama3-70b-8192",
    "LLAMA3_8B": "llama3-8b-8192",
    "LLAMA31_70B": "llama-3.1-70b-versatile",
    "MIXTRAL8_7B": "mixtral-8x7b-32768"
  },
  [LLMProviders.CUSTOM]: {}
}

export class LLMError extends Error {}

const BEDROCK_KEY = CONFIG.verida.llms.bedrockKey
const BEDROCK_ENDPOINT = CONFIG.verida.llms.bedrockEndpoint

// const GROQ_MODEL = 'llama3-70b-8192' // 'llama3-8b-8192' // 'llama3-70b-8192' // 'llama3-8b-8192' //'llama-3.1-8b-instant' //'llama3-70b-8192' // 'llama3-8b-8192'
const GROQ_KEY = CONFIG.verida.llms.groqKey

export interface OpenAIConfig {
  endpoint: string
  key?: string
}

export const LLMS: Record<string, OpenAIConfig> = {
  BEDROCK: {
    endpoint: BEDROCK_ENDPOINT,
    key: BEDROCK_KEY
  }
}

export interface LLMResponse {
  agent: string
}

export interface LLM {
  prompt(userPrompt: string, systemPrompt?: string, jsonFormat?: boolean, model?: string): Promise<OpenAIChatResponse>
}

function stripNonJson(inputString: string) {
  const startIndex = inputString.indexOf('{')
  const endIndex = inputString.lastIndexOf('}')

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return '' // Return an empty string if braces are not found or invalid
  }

  return inputString.substring(startIndex, endIndex + 1)
}

// export interface OpenAIChatResponse {
//   id: string;
//   object: string;
//   created: number;
//   model: string;
//   choices: {
//     index: number;
//     message: {
//       role: string;
//       content: string;
//     };
//     finish_reason: string;
//   }[];
//   usage?: {
//     prompt_tokens: number;
//     completion_tokens: number;
//     total_tokens: number;
//   };
// };
export interface OpenAIChatResponse extends Groq.Chat.ChatCompletion {}

export class GroqLLM implements LLM {
  private groq: Groq
  private defaultModel: string

  constructor(defaultModel: string) {
    this.defaultModel = defaultModel

    if (GROQ_KEY) {
      this.groq = new Groq({ apiKey: GROQ_KEY });
    } else {
      console.warn("Unable to initialize Grok: No key specified")
    }
  }

  public async prompt(userPrompt: string, systemPrompt?: string, jsonFormat: boolean = true, model: string = this.defaultModel): Promise<OpenAIChatResponse> {
    if (jsonFormat) {
      userPrompt += `\nOnly output a JSON object. Don't add any explanation or formatting.\n`
    }

    const messages = [
      {
        role: "user",
        content: userPrompt,
      }
    ];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      })
    }

    const response = await this.groq.chat.completions.create({
      response_format: jsonFormat ? {type: "json_object"} : undefined,
      // @ts-ignore
      messages,
      model,
      temperature: 1,
      top_p: 1
    });

    if (jsonFormat) {
      response.choices[0].message.content = stripNonJson(response.choices[0].message.content!)
    }

    return response
}
}

export class OpenAILLM implements LLM {

  private config: OpenAIConfig
  private defaultModel: string

  constructor(config: OpenAIConfig, defaultModel: string) {
    this.config = config
    this.defaultModel = defaultModel
  }

  public async prompt(userPrompt: string, systemPrompt?: string, jsonFormat: boolean = true, model: string = this.defaultModel): Promise<OpenAIChatResponse> {
    console.log('openai prompt start:')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.key) {
      headers['Authorization'] = `Bearer ${this.config.key}` 
    }

    if (jsonFormat) {
      userPrompt += `\nOnly output a JSON object. Don't add any explanation or formatting.\n`
    }

    const messages = [
      {
        role: "user",
        content: userPrompt,
      }
    ];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      })
    }

    try {
      const response = await Axios.post(this.config.endpoint, {
        format: jsonFormat ? "json" : undefined,
        messages,
        model,
        temperature: 1,
        top_p: 1
      }, {
        headers
      });

      if (jsonFormat) {
        response.data.choices[0].message.content = stripNonJson(response.data.choices[0].message.content!)
      }

      return response.data
    } catch (err: any) {
      if (err.response?.data?.detail) {
        throw new LLMError(err.response.data.detail)
      }

      throw err
    }
  }
}

export function getLLM(provider: LLMProviders = LLMProviders.BEDROCK, model: string = "LLAMA3_70B", customEndpoint?: OpenAIConfig): LLM {
  let llm: LLM
  switch (provider) {
    case LLMProviders.BEDROCK:
      llm = new OpenAILLM(LLMS.BEDROCK, model)
      break
    case LLMProviders.GROQ:
      llm = new GroqLLM(model)
      break
    case LLMProviders.CUSTOM:
      llm = new OpenAILLM(customEndpoint, model)
  }

  return llm
}

export async function prompt(userPrompt: string, systemPrompt?: string, jsonFormat: boolean = true, provider: LLMProviders = LLMProviders.BEDROCK, model: string = "LLAMA3_70B", customEndpoint?: OpenAIConfig): Promise<OpenAIChatResponse> {
  const llm = getLLM(provider, model, customEndpoint)
  return llm.prompt(userPrompt, systemPrompt, jsonFormat, model)
}

export const bedrock = new OpenAILLM(LLMS.BEDROCK, "LLAMA3_70B")
export const groq = new GroqLLM("LLAMA3_70B")
export const defaultModel = bedrock