import { BaseDataSchema } from "../../schemas/base";
import { BaseQueryTool } from "./base";
import { IContext } from "@verida/types";
import { ChatMessageQueryTool } from "./chatMessage";

export function generateQueryToolFromDataSchema(name: string, dataSchema: BaseDataSchema, context: IContext, tokenLimit: number) {
    let toolType = BaseQueryTool
    if (name == "ChatMessage") {
        toolType = ChatMessageQueryTool
    }


    const tool = new toolType(context, tokenLimit, {
        schemaDefinition: dataSchema.getQuerySchemaString(),
        schemaUrl: dataSchema.getUrl(),
        defaultParams: dataSchema.getDefaultQueryParams(),
        extraDetail: dataSchema.getDescription()
    })

    tool.name = `${name}Query`
    return tool
}