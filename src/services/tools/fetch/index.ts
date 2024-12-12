import { BaseDataSchema } from "../../schemas/base";
import { BaseFetchTool } from "./base";
import { IContext } from "@verida/types";

export function generateFetchToolFromDataSchema(name: string, dataSchema: BaseDataSchema, context: IContext) {
    const tool = new BaseFetchTool(context, {
        schemaUrl: dataSchema.getUrl()
    })

    tool.name = `${name}Fetch`
    return tool
}