import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { getDataSchemas } from "../schemas";
import { generateQueryToolFromDataSchema } from "./query";
import { KeywordIndexTool } from "./keywordIndex";

export function getTools(context: IContext, tokenLimit: number = 100000): Record<string, Tool> {
    // Get data schema tools
    const dataSchemas = getDataSchemas()
    const tools: Record<string, Tool> = {}

    for (const dataSchema of dataSchemas) {
        tools[`${dataSchema.getName()}Query`] = generateQueryToolFromDataSchema(dataSchema.getName(), dataSchema, context, tokenLimit)
    }

    // Get vector store tool
    // tools["VectoreStore"] = new VectoreStoreTool(context)
    tools["KeywordIndex"] = new KeywordIndexTool(context, tokenLimit)

    return tools
}