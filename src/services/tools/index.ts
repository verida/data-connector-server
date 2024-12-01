import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { getDataSchemas } from "../schemas";
import { generateQueryToolFromDataSchema } from "./query";
import { VectoreStoreTool } from "./vectoreStore";

export function getTools(context: IContext): Record<string, Tool> {
    // Get data schema tools
    const dataSchemas = getDataSchemas()
    const tools: Record<string, Tool> = {}

    for (const dataSchema of dataSchemas) {
        tools[`${dataSchema.getName()}Query`] = generateQueryToolFromDataSchema(dataSchema.getName(), dataSchema, context)
    }

    // Get vector store tool
    tools["VectoreStore"] = new VectoreStoreTool(context)

    return tools
}