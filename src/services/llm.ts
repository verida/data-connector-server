import Groq from "groq-sdk"
import Axios from 'axios'
import CONFIG from "../config"

const enum BedrockModels {
  LLAMA3_70B = "meta.llama3-70b-instruct-v1:0",
  LLAMA3_8B = "meta.llama3-8b-instruct-v1:0",
  MIXTRAL_8_7B = "mistral.mixtral-8x7b-instruct-v0:1"
}

const enum GroqModels {
  LLAMA3_70B = "llama3-70b-8192",
  LLAMA3_8B = "llama3-8b-8192",
  LLAMA31_70B = "llama-3.1-70b-versatile"
}

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
  prompt(userPrompt: string, systemPrompt?: string, format?: boolean, model?: string): Promise<OpenAIChatResponse>
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.key) {
      headers['Authorization'] = `Bearer ${this.config.key}` 
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

    const response = await Axios.post(this.config.endpoint, {
      format: jsonFormat ? "json" : undefined,
      messages,
      model,
      temperature: 1,
      top_p: 1
    }, {
      headers
    });

    return response.data
  }
}

export const bedrock = new OpenAILLM(LLMS.BEDROCK, BedrockModels.LLAMA3_70B)
export const groq = new GroqLLM(GroqModels.LLAMA3_70B)
export const defaultModel = groq