import Groq from "groq-sdk"
import { BedrockRuntimeClient, ConverseCommand, ConverseCommandInput } from "@aws-sdk/client-bedrock-runtime"
import Axios from 'axios'
import CONFIG from "../config"
import { LLMProvider, ProviderModels } from "./llmmodels"

export class LLMError extends Error {}

const BEDROCK_KEY = CONFIG.verida.llms.bedrockKey
const BEDROCK_ENDPOINT = CONFIG.verida.llms.bedrockEndpoint
const BEDROCK_ACCESS_KEY_ID = CONFIG.verida.llms.bedrockAWSAccessKeyId
const BEDROCK_SECRET_KEY = CONFIG.verida.llms.bedrockAWSSecretKey

const DEFAULT_LLM_MODEL = CONFIG.verida.llms.defaultModel
const DEFAULT_LLM_PROVIDER = <LLMProvider> CONFIG.verida.llms.defaultProvider

const GROQ_KEY = CONFIG.verida.llms.groqKey

export interface OpenAIConfig {
  // HTTP(s) endpoint for the Open AI server
  endpoint: string
  // Bearer token key (optional)
  key?: string
  // Indicate if the model doesn't support system prompts
  noSystemPrompt?: boolean
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
  getContextTokens(model?: string): number
}

export function stripNonJson(inputString: string) {
  const startIndex = inputString.indexOf('{')
  const endIndex = inputString.lastIndexOf('}')

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return '' // Return an empty string if braces are not found or invalid
  }

  // Sometimes the LLM creates incorrect JSON by escaping "_"
  return inputString.substring(startIndex, endIndex + 1).replace(/\\_/g,`_`)
}

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
  private llmTokenLimit?: number

  constructor(defaultModel: string, llmTokenLimit?: number) {
    this.defaultModel = defaultModel
    this.llmTokenLimit = llmTokenLimit

    if (GROQ_KEY) {
      this.groq = new Groq({ apiKey: GROQ_KEY });
    } else {
      console.warn("Unable to initialize Grok: No key specified")
    }
  }

  public getContextTokens(modelId?: string): number {
    if (this.llmTokenLimit) {
      return this.llmTokenLimit
    }

    const model = ProviderModels[LLMProvider.GROQ][modelId || this.defaultModel]
    return model.contextTokens
  }

  public async prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, modelId: string = this.defaultModel): Promise<PromptResponse> {
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

    const model = ProviderModels[LLMProvider.GROQ][modelId]
    const response = await this.groq.chat.completions.create({
      response_format: jsonFormat ? {type: "json_object"} : undefined,
      // @ts-ignore
      messages,
      model: model.modelId,
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
  private llmTokenLimit?: number

  constructor(defaultModel: string, llmTokenLimit?: number) {
    this.defaultModel = defaultModel
    this.llmTokenLimit = llmTokenLimit

    this.bedrock = new BedrockRuntimeClient({ region: "us-east-1", credentials: {
      accessKeyId: BEDROCK_ACCESS_KEY_ID,
      secretAccessKey: BEDROCK_SECRET_KEY
    }, });
  }

  public getContextTokens(modelId?: string): number {
    if (this.llmTokenLimit) {
      return this.llmTokenLimit
    }

    const model = ProviderModels[LLMProvider.BEDROCK][modelId || this.defaultModel]
    return model.contextTokens
  }
  
  public async prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, modelId: string = this.defaultModel): Promise<PromptResponse> {
    try {
      const model = ProviderModels[LLMProvider.BEDROCK][modelId]

      if (!model.systemPrompt) {
        userPrompt = `${systemPrompt}\n\n${userPrompt}`
      }

      const input: ConverseCommandInput = {
        modelId: model.modelId,
        messages: [{
          role: "user",
          content: [{
            text: userPrompt
          }]
        }]
      }

      if (systemPrompt && model.systemPrompt) {
        input.system = [{
          text: systemPrompt
        }]
      }

      const command = new ConverseCommand(input)
      const response = await this.bedrock.send(command)

      if (response['$metadata'].httpStatusCode !== 200) {
        console.error(response['$metadata'])
        throw new Error(`Bedrock error`)
      }

      if (jsonFormat) {
        response.output.message.content[0].text = stripNonJson(response.output.message.content[0].text)
      }

      // @ts-ignore
      return {
        textResponse: response.output.message.content[0].text,
        usage: response.usage
      }

    } catch (error: any) {
      console.error(error)
    }
  }
}

export class OpenAILLM implements LLM {

  private config: OpenAIConfig
  private defaultModel: string
  private llmTokenLimit?: number

  constructor(config: OpenAIConfig, defaultModel: string, llmTokenLimit?: number) {
    this.config = config
    this.defaultModel = defaultModel
    this.llmTokenLimit = llmTokenLimit
  }

  public getContextTokens(modelId?: string): number {
    if (this.llmTokenLimit) {
      return this.llmTokenLimit
    }

    throw new Error(`Unknown context token size for this model, please specify`)
  }

  public async prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, modelId: string = this.defaultModel): Promise<PromptResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.key) {
      headers['Authorization'] = `Bearer ${this.config.key}` 
    }

    if (jsonFormat) {
      userPrompt += `\nOnly output a JSON object. Don't add any explanation or formatting.\n`
    }

    if (this.config.noSystemPrompt) {
      userPrompt = `${systemPrompt}\n\n${userPrompt}`
    }

    const messages = [
      {
        role: "user",
        content: userPrompt,
      }
    ];

    if (systemPrompt && !this.config.noSystemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      })
    }

    try {
      const response = await Axios.post(this.config.endpoint, {
        format: jsonFormat ? "json" : undefined,
        messages,
        model: modelId,
        temperature: 1,
        top_p: 1
      }, {
        headers
      });

      if (jsonFormat) {
        response.data.choices[0].message.content = stripNonJson(response.data.choices[0].message.content!)
      }

      return {
        textResponse: response.data.choices[0].message.content
      }
    } catch (err: any) {
      console.error(err)
      if (err.response?.data?.detail) {
        throw new LLMError(err.response.data.detail)
      }

      throw err
    }
  }
}

export function getLLM(provider: LLMProvider = DEFAULT_LLM_PROVIDER, model: string = DEFAULT_LLM_MODEL, llmTokenLimit?: number, customEndpoint?: OpenAIConfig): LLM {
  let llm: LLM
  switch (provider) {
    case LLMProvider.BEDROCK:
      // llm = new OpenAILLM(LLMS.BEDROCK, model)
      llm = new BedrockLLM(model, llmTokenLimit)
      break
    case LLMProvider.GROQ:
      llm = new GroqLLM(model, llmTokenLimit)
      break
    case LLMProvider.CUSTOM:
      llm = new OpenAILLM(customEndpoint, model, llmTokenLimit)
  }

  return llm
}

export async function prompt(userPrompt: string, systemPrompt: string, jsonFormat: boolean = true, provider: LLMProvider = DEFAULT_LLM_PROVIDER, model: string = DEFAULT_LLM_MODEL, llmTokenLimit?: number, customEndpoint?: OpenAIConfig): Promise<PromptResponse> {
  const llm = getLLM(provider, model, llmTokenLimit, customEndpoint)
  return llm.prompt(userPrompt, systemPrompt, jsonFormat, model)
}