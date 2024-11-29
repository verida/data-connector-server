import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { z } from "zod";

const CouchDBQuerySchema = z.object({
    selector: z.record(z.string(), z.any()).describe(`Couchdb selector object`),
    fields: z.array(z.string()).optional().describe(`Array of fields to include in the result`),
    sort: z
      .array(
        z.record(z.string(), z.enum(["asc", "desc"])).describe(`Example: [{ "sentAt": "desc" }]`),
      )
      .optional(),
    limit: z.number().optional().describe(`Maximum number of documents to return`),
    skip: z.number().optional().describe(`Number of documents to skip`)
});

type CouchDBQuerySchemaType = z.infer<typeof CouchDBQuerySchema>;

export interface BaseQueryToolConfig {
    schemaDefinition: string
    schemaUrl: string
    defaultParams: Partial<CouchDBQuerySchemaType>
}

// ['name', 'type', 'fromName', 'fromEmail', 'messageText', 'sentAt']

export class BaseQueryTool extends Tool {
  private context: IContext

  constructor(context: IContext) {
    super()
    this.context = context
  }

  name = "Unknown"

  protected getConfig(): BaseQueryToolConfig {
    throw new Error(`getConfig() not implemented`)
  }

  /** @ignore */
  public async _call(args: string) {
    const config = this.getConfig()

    try {
      const params: CouchDBQuerySchemaType = JSON.parse(args)

      const selector = params.selector || config.defaultParams.selector
      const fields = params.fields || config.defaultParams.fields
      const sort = params.sort || config.defaultParams.sort
      const limit = params.limit || config.defaultParams.limit
      const skip = params.skip || config.defaultParams.skip

      const db = await this.context.openDatastore(config.schemaUrl)

      const result = await db.getMany(selector, {
        fields,
        sort,
        limit,
        skip
      })

      return JSON.stringify(result)

    } catch (error) {
      return `${error}`;
    }
  }

  description = `Input to this tool is a detailed and correct CouchDB query of received emails with the following schema ${this.getConfig().schemaDefinition}.
  If the query is not correct, an error message will be returned.
  If an error is returned, rewrite the query, check the query, and try again.`

}