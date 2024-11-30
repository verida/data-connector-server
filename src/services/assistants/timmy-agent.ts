import { IContext } from "@verida/types";
import CONFIG from "../../config";
import { ChatBedrockConverse } from "@langchain/aws";
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { createToolCallingAgent } from "langchain/agents"
import { AgentExecutor } from "langchain/agents"
import { getTools } from "../tools";

const BEDROCK_AWS_REGION = "us-east-1";
const BEDROCK_AWS_SECRET_ACCESS_KEY = CONFIG.verida.llms.bedrockAWSSecretKey;
const BEDROCK_AWS_ACCESS_KEY_ID = CONFIG.verida.llms.bedrockAWSAccessKeyId;
const MODEL = `us.anthropic.claude-3-5-haiku-20241022-v1:0`;

export class TimmyAgent {
  public async run(promptString: string, context: IContext) {
    const toolsByName = getTools(context)

    const tools = Object.values(toolsByName)

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful assistant"],
        ["placeholder", "{chat_history}"],
        ["human", "{input}"],
        ["placeholder", "{agent_scratchpad}"],
      ])

    const llm = new ChatBedrockConverse({
      model: MODEL,
      temperature: 0,
      maxTokens: undefined,
      timeout: undefined,
      maxRetries: 2,
      region: BEDROCK_AWS_REGION,
      credentials: {
        secretAccessKey: BEDROCK_AWS_SECRET_ACCESS_KEY,
        accessKeyId: BEDROCK_AWS_ACCESS_KEY_ID!,
      },
    });

    const agent = await createToolCallingAgent({ llm, tools, prompt });

    const agentExecutor = new AgentExecutor({
        agent,
        tools,
      })

     const response = await agentExecutor.invoke({ input: promptString })

     return response
  }
}
