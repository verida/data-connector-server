import { IContext } from "@verida/types";
import CONFIG from "../../config";
import { ChatBedrockConverse } from "@langchain/aws";
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { createToolCallingAgent } from "langchain/agents"
import { AgentExecutor } from "langchain/agents"
import { getTools } from "../tools";
import { RunCollectorCallbackHandler } from "langchain/callbacks";

const BEDROCK_AWS_REGION = CONFIG.verida.llms.bedrockAWSRegion;
const BEDROCK_AWS_SECRET_ACCESS_KEY = CONFIG.verida.llms.bedrockAWSSecretKey;
const BEDROCK_AWS_ACCESS_KEY_ID = CONFIG.verida.llms.bedrockAWSAccessKeyId;
const MODEL = CONFIG.verida.llms.agentModel;
const MODEL_MAX_TOKENS = CONFIG.verida.llms.agentTokenLimit

export class Agent {
  public async run(promptString: string, context: IContext, temperature: number = 0) {
    const toolsByName = getTools(context, MODEL_MAX_TOKENS)

    const tools = Object.values(toolsByName)

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful assistant with access to all my personal data"],
        ["placeholder", "{chat_history}"],
        ["human", "{input}"],
        ["placeholder", "{agent_scratchpad}"],
      ])

    const llm = new ChatBedrockConverse({
      model: MODEL,
      temperature,
      // maxTokens: 128000,
      timeout: undefined,
      maxRetries: 2,
      region: BEDROCK_AWS_REGION,
      credentials: {
        secretAccessKey: BEDROCK_AWS_SECRET_ACCESS_KEY,
        accessKeyId: BEDROCK_AWS_ACCESS_KEY_ID!,
      },
    });

    const handler = new RunCollectorCallbackHandler()
    const agent = await createToolCallingAgent({ llm, tools, prompt });
    const agentExecutor = new AgentExecutor({
        agent,
        tools,
        callbacks: [handler]
      })

     const response = await agentExecutor.invoke({ input: promptString })


     const run = handler.tracedRuns[0]
     const actions: any[] = []
     const tokens: any = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0
     }

     // @ts-ignore
     for (const action: any of run.actions) {
      const log = action.messageLog[0]
      actions.push({
        name: action.tool,
        input: action.input,
        duration: log.response_metadata.metadata.metrics.latencyMs,
        tokens: log.usage_metadata
      })

      tokens.input_tokens += log.usage_metadata.input_tokens
      tokens.output_tokens += log.usage_metadata.output_tokens
      tokens.total_tokens += log.usage_metadata.total_tokens
     }

     const result: any = {
      input: promptString,
      actions,
      output: response.output,
      tokens,
      duration: (run.end_time - run.start_time)
     }

     return result
  }
}
