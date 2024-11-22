import Groq from "groq-sdk"
import { BedrockRuntimeClient, ConverseCommand, ConverseCommandInput } from "@aws-sdk/client-bedrock-runtime"
import Axios from 'axios'
import CONFIG from "../config"

export enum LLMProvider {
  BEDROCK = "bedrock",
  GROQ = "groq",
  CUSTOM = "custom"
}

const AWS_ACCOUNT_ID = CONFIG.verida.llms.bedrockAWSAccountId

export interface ProviderModel {
  modelId: string
  systemPrompt: boolean
  contextTokens: number
}

export const ProviderModels: Record<LLMProvider, Record<string, ProviderModel>> = {
  [LLMProvider.BEDROCK]: {
    "LLAMA3.2_3B": {
      modelId: `arn:aws:bedrock:us-east-1:${AWS_ACCOUNT_ID}:inference-profile/us.meta.llama3-2-3b-instruct-v1:0`,
      systemPrompt: true,
      contextTokens: 128000
    },
    "LLAMA3.2_1B": {
      modelId: `arn:aws:bedrock:us-east-1:${AWS_ACCOUNT_ID}:inference-profile/us.meta.llama3-2-1b-instruct-v1:0`,
      systemPrompt: true,
      contextTokens: 128000
    },
    "LLAMA3.1_70B": {
      modelId: `arn:aws:bedrock:us-east-1:${AWS_ACCOUNT_ID}:inference-profile/us.meta.llama3-1-70b-instruct-v1:0`,
      systemPrompt: true,
      contextTokens: 128000
    },
    "LLAMA3.1_8B": {
      modelId: `arn:aws:bedrock:us-east-1:${AWS_ACCOUNT_ID}:inference-profile/us.meta.llama3-1-8b-instruct-v1:0`,
      systemPrompt: true,
      contextTokens: 128000
    },
    "LLAMA3_70B": {
      modelId: `meta.llama3-70b-instruct-v1:0`,
      systemPrompt: true,
      contextTokens: 8000
    },
    "LLAMA3_8B": {
      modelId: `meta.llama3-8b-instruct-v1:0`,
      systemPrompt: true,
      contextTokens: 8000
    },
    "MIXTRAL_8_7B": {
      modelId: "mistral.mixtral-8x7b-instruct-v0:1",
      systemPrompt: true,
      contextTokens: 32000
    },
    "MIXTRAL_SMALL": {
      modelId: "mistral.mistral-small-2402-v1:0",
      systemPrompt: true,
      contextTokens: 32000
    },
    "MIXTRAL_LARGE": {
      modelId: "mistral.mistral-large-2402-v1:0",
      systemPrompt: true,
      contextTokens: 32000
    }
  },
  [LLMProvider.GROQ]: {
    "LLAMA3_70B": {
      modelId: "llama3-70b-8192",
      systemPrompt: true,
      contextTokens: 128000
    },
    "LLAMA3_8B": {
      modelId: "llama3-8b-8192",
      systemPrompt: true,
      contextTokens: 128000
    },
    "LLAMA3.1_70B": {
      modelId: "llama-3.1-70b-versatile",
      systemPrompt: true,
      contextTokens: 128000
    },
    "MIXTRAL8_7B": {
      modelId: "mixtral-8x7b-32768",
      systemPrompt: false,
      contextTokens: 32000
    }
  },
  [LLMProvider.CUSTOM]: {}
}

export class LLMError extends Error {}

const BEDROCK_KEY = CONFIG.verida.llms.bedrockKey
const BEDROCK_ENDPOINT = CONFIG.verida.llms.bedrockEndpoint
const BEDROCK_ACCESS_KEY_ID = CONFIG.verida.llms.bedrockAWSAccessKeyId
const BEDROCK_SECRET_KEY = CONFIG.verida.llms.bedrockAWSSecretKey

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
  prompt(userPrompt: string, systemPrompt: string, jsonFormat?: boolean, model?: string): Promise<PromptResponse>
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

export interface PromptUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface PromptResponse {
  textResponse: string
  usage?: PromptUsage
  timeMs?: number
}

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

  public async prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, model: string = this.defaultModel): Promise<PromptResponse> {
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

    return {
      textResponse: response.choices[0].message.content
    }
  }
}

export class BedrockLLM implements LLM {

  private bedrock: BedrockRuntimeClient
  private defaultModel: string

  constructor(defaultModel: string) {
    this.defaultModel = defaultModel

    this.bedrock = new BedrockRuntimeClient({ region: "us-east-1", credentials: {
      accessKeyId: BEDROCK_ACCESS_KEY_ID,
      secretAccessKey: BEDROCK_SECRET_KEY
    }, });

    // if (GROQ_KEY) {
    //   this.groq = new Groq({ apiKey: GROQ_KEY });
    // } else {
    //   console.warn("Unable to initialize Grok: No key specified")
    // }
  }
  
  public async prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, modelId: string = this.defaultModel): Promise<PromptResponse> {
    console.log('bedrock!', modelId)

    console.log(userPrompt)

    try {

    const model = ProviderModels[LLMProvider.BEDROCK][modelId]

      const input: ConverseCommandInput = {
        modelId: model.modelId,
        messages: [{
          role: "user",
          content: [{
            text: userPrompt
          }]
        }],
        system: [{
          text: systemPrompt
        }]
      }

      const command = new ConverseCommand(input)
      const response = await this.bedrock.send(command)

      if (response['$metadata'].httpStatusCode !== 200) {
        console.error(response['$metadata'])
        throw new Error(`Bedrock error`)
      }

      const r = response.output.message.content[0].text
      console.log(r.substring(0,10))
      console.log(r.substring(r.length-10))

      if (jsonFormat) {
        response.output.message.content[0].text = stripNonJson(response.output.message.content[0].text)
      }

      // @ts-ignore
      return {
        textResponse: response.output.message.content[0].text
      }

    } catch (error: any) {
      console.error(error)
    }
  }
}

export class OpenAILLM implements LLM {

  private config: OpenAIConfig
  private defaultModel: string

  constructor(config: OpenAIConfig, defaultModel: string) {
    this.config = config
    this.defaultModel = defaultModel
  }

  public async prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, model: string = this.defaultModel): Promise<PromptResponse> {
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
      console.log(model)

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

      // console.log('----- START')
      // console.log(systemPrompt)
      // console.log('-----')
      // console.log(userPrompt)
      // console.log('-----')
      // console.log(response.data)
      // console.log('----- END')

      return {
        textResponse: response.data.choices[0].message.content
      }
    } catch (err: any) {
      console.log(err.response.data)
      if (err.response?.data?.detail) {
        throw new LLMError(err.response.data.detail)
      }

      throw err
    }
  }
}

export function getLLM(provider: LLMProvider = LLMProvider.BEDROCK, model: string = "LLAMA3_70B", customEndpoint?: OpenAIConfig): LLM {
  let llm: LLM
  switch (provider) {
    case LLMProvider.BEDROCK:
      // llm = new OpenAILLM(LLMS.BEDROCK, model)
      llm = new BedrockLLM(model)
      break
    case LLMProvider.GROQ:
      llm = new GroqLLM(model)
      break
    case LLMProvider.CUSTOM:
      llm = new OpenAILLM(customEndpoint, model)
  }

  return llm
}

export async function prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, provider: LLMProvider = LLMProvider.BEDROCK, model: string = "LLAMA3_70B", customEndpoint?: OpenAIConfig): Promise<PromptResponse> {
  const llm = getLLM(provider, model, customEndpoint)
  return llm.prompt(userPrompt, systemPrompt, jsonFormat, model)
}