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
    skip: z.number().optional().describe(`Number of documents to skip`),
    count: z.boolean().optional().describe(`If true, a count of the number of matching results will be returned`)
});

type CouchDBQuerySchemaType = z.infer<typeof CouchDBQuerySchema>;

export interface BaseQueryToolConfig {
    schemaDefinition: string
    schemaUrl: string
    defaultParams: Partial<CouchDBQuerySchemaType>
    extraDetail: string
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

      let selector = params.selector || config.defaultParams.selector
      let fields = params.fields || config.defaultParams.fields
      let sort = params.sort || config.defaultParams.sort
      let limit = params.limit || config.defaultParams.limit
      let skip = params.skip || config.defaultParams.skip

      const db = await this.context.openDatastore(config.schemaUrl)

      // If counting records, only fetch the _id field and fetch 1000 at a time
      if (params.count) {
        limit = 1000
        fields = ['_id']

        const loops = 0
        while (true) {
          const result = await db.getMany(selector, {
            fields,
            sort,
            limit,
            skip: loops * limit
          })

          if (result.length < limit) {
            console.log(result.length)
            return (loops*limit + result.length).toString()
          }
        }
      }

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

  description = `Input to this tool is a detailed and correct CouchDB query of ${this.getConfig().extraDetail} with the following schema ${this.getConfig().schemaDefinition}.
  Set count=true to return the number of matching results, rather than the results themselves.
  If the query is not correct, an error message will be returned.
  If an error is returned, rewrite the query, check the query, and try again.
  The default result limit is ${this.getConfig().defaultParams.limit}`

}