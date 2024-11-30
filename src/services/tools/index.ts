import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { getDataSchemas } from "../schemas";
import { generateQueryToolFromDataSchema } from "./query";

export function getTools(context: IContext): Record<string, Tool> {
    const dataSchemas = getDataSchemas()
    const tools: Record<string, Tool> = {}

    for (const dataSchema of dataSchemas) {
        tools[`${dataSchema.getName()}Query`] = generateQueryToolFromDataSchema(dataSchema.getName(), dataSchema, context)
    }

    return tools
}