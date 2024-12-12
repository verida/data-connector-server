import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { getDataSchemas } from "../schemas";
import { generateQueryToolFromDataSchema } from "./query";
import { generateFetchToolFromDataSchema } from "./fetch";
import { KeywordIndexTool } from "./keywordIndex";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search"
import CONFIG from "../../config"

export function getTools(context: IContext, tokenLimit: number = 100000): Record<string, Tool> {
    // Get data schema tools
    const dataSchemas = getDataSchemas()
    const tools: Record<string, Tool> = {}

    for (const dataSchema of dataSchemas) {
        tools[`${dataSchema.getName()}Fetch`] = generateFetchToolFromDataSchema(dataSchema.getName(), dataSchema, context)
        tools[`${dataSchema.getName()}Query`] = generateQueryToolFromDataSchema(dataSchema.getName(), dataSchema, context, tokenLimit)
    }

    // tools["VectoreStore"] = new VectoreStoreTool(context)
    tools["KeywordIndex"] = new KeywordIndexTool(context, tokenLimit)

    tools["WebSearch"] = new TavilySearchResults({
        maxResults: 2,
        apiKey: CONFIG.verida.llms.tavilyKey
        // ...
    })
    

    return tools
}