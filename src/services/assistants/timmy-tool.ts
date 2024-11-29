import { IContext } from "@verida/types";
import { EmailQueryTool } from "../tools/query/email";
import CONFIG from "../../config";
import { ChatBedrockConverse } from "@langchain/aws";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { CalendarEventQueryTool } from "../tools/query/calendar";

const BEDROCK_AWS_REGION = "us-east-1";
const BEDROCK_AWS_SECRET_ACCESS_KEY = CONFIG.verida.llms.bedrockAWSSecretKey;
const BEDROCK_AWS_ACCESS_KEY_ID = CONFIG.verida.llms.bedrockAWSAccessKeyId;
const MODEL = `us.anthropic.claude-3-5-haiku-20241022-v1:0`;

export class TimmyTool {
  public async run(prompt: string, context: IContext) {
    const emailTool = new EmailQueryTool(context);
    const calendarEventTool = new CalendarEventQueryTool(context);

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

    const messages: (HumanMessage | ToolMessage)[] = [new HumanMessage(prompt)];

    const aiMessage = await llm.invoke(messages, {
      tools: [emailTool, calendarEventTool],
      tool_choice: "auto",
    });

    messages.push(aiMessage);

    const toolsByName = {
      EmailQuery: emailTool,
      CalendarEventQuery: calendarEventTool,
    };

    for (const toolCall of aiMessage.tool_calls) {
      // @ts-ignore
      const selectedTool = toolsByName[toolCall.name];
      const toolResult = await selectedTool.invoke(toolCall);
      messages.push(toolResult);
    }

    const result = await llm.invoke(messages, {
      tools: [emailTool, calendarEventTool],
      tool_choice: "auto",
    });
    return result;
  }
}
