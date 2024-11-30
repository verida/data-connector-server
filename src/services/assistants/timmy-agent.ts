import { IContext } from "@verida/types";
import { EmailQueryTool } from "../tools/query/email";
import CONFIG from "../../config";
import { ChatBedrockConverse } from "@langchain/aws";
import { CalendarEventQueryTool } from "../tools/query/calendarEvent";
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { createToolCallingAgent } from "langchain/agents"
import { AgentExecutor } from "langchain/agents"
import { FileQueryTool } from "../tools/query/file";
import { FollowingQueryTool } from "../tools/query/following";
import { PostQueryTool } from "../tools/query/post";
import { ChatGroupQueryTool } from "../tools/query/chatGroup";

const BEDROCK_AWS_REGION = "us-east-1";
const BEDROCK_AWS_SECRET_ACCESS_KEY = CONFIG.verida.llms.bedrockAWSSecretKey;
const BEDROCK_AWS_ACCESS_KEY_ID = CONFIG.verida.llms.bedrockAWSAccessKeyId;
const MODEL = `us.anthropic.claude-3-5-haiku-20241022-v1:0`;

export class TimmyAgent {
  public async run(promptString: string, context: IContext) {
    const emailTool = new EmailQueryTool(context);
    const calendarEventTool = new CalendarEventQueryTool(context);
    const fileTool = new FileQueryTool(context);
    const postTool = new PostQueryTool(context);
    const followingTool = new FollowingQueryTool(context);
    const chatGroupTool = new ChatGroupQueryTool(context)

    const toolsByName = {
        EmailQuery: emailTool,
        CalendarEventQuery: calendarEventTool,
        FileQuery: fileTool,
        PostQuery: postTool,
        FollowingQuery: followingTool,
        ChatGroupQuery: chatGroupTool
    };

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
