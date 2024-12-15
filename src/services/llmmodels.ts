import CONFIG from "../config"
const AWS_ACCOUNT_ID = CONFIG.verida.llms.bedrockAWSAccountId

export enum LLMProvider {
    BEDROCK = "bedrock",
    GROQ = "groq",
    CUSTOM = "custom"
  }
  
  export interface ProviderModel {
    modelId: string
    systemPrompt: boolean
    contextTokens: number
  }
  
  export const ProviderModels: Record<LLMProvider, Record<string, ProviderModel>> = {
    [LLMProvider.BEDROCK]: {
      "CLAUDE_HAIKU_3.5": {
        modelId: `arn:aws:bedrock:us-west-2:${AWS_ACCOUNT_ID}:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0`,
        systemPrompt: true,
        contextTokens: 200000
      },
      "LLAMA3.2_3B": {
        modelId: `arn:aws:bedrock:us-east-1:${AWS_ACCOUNT_ID}:inference-profile/us.meta.llama3-2-3b-instruct-v1:0`,
        systemPrompt: true,
        contextTokens: 128000
      },
      "LLAMA3.2_11B": {
        modelId: `arn:aws:bedrock:us-east-1:${AWS_ACCOUNT_ID}:inference-profile/us.meta.llama3-2-11b-instruct-v1:0`,
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
    // Groq is deperecated as their token limits are so low
    [LLMProvider.GROQ]: {
      "LLAMA3_70B": {
        modelId: "llama3-70b-8192",
        systemPrompt: true,
        contextTokens: 6000
      },
      "LLAMA3_8B": {
        modelId: "llama3-8b-8192",
        systemPrompt: true,
        contextTokens: 30000
      },
      "LLAMA3.1_70B": {
        modelId: "llama-3.1-70b-versatile",
        systemPrompt: true,
        contextTokens: 6000
      },
      "MIXTRAL8_7B": {
        modelId: "mixtral-8x7b-32768",
        systemPrompt: false,
        contextTokens: 32000
      }
    },
    [LLMProvider.CUSTOM]: {}
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