import { BaseDataSchema } from "../../schemas/base";
import { BaseQueryTool } from "./base";
import { IContext } from "@verida/types";

export function generateQueryToolFromDataSchema(name: string, dataSchema: BaseDataSchema, context: IContext, tokenLimit: number) {
    const tool = new BaseQueryTool(context, tokenLimit, {
        schemaDefinition: dataSchema.getQuerySchemaString(),
        schemaUrl: dataSchema.getUrl(),
        defaultParams: dataSchema.getDefaultQueryParams(),
        extraDetail: dataSchema.getDescription()
    })

    tool.name = `${name}Query`
    return tool
}