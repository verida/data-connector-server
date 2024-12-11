import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { BaseQueryToolConfig, CouchDBQuerySchemaType } from "../../../services/interfaces";
import { convertRecordsToRAGContext } from "../utils";

export class BaseQueryTool extends Tool {
  private context: IContext
  private config: BaseQueryToolConfig
  private tokenLimit: number

  name = ""
  description = ""

  constructor(context: IContext, tokenLimit: number, config: BaseQueryToolConfig) {
    super()
    this.context = context
    this.config = config
    this.tokenLimit = tokenLimit
    this.description = `Input to this tool is a detailed and correct CouchDB query of ${this.getConfig().extraDetail} with the following schema ${this.getConfig().schemaDefinition}.
    Ensure you only use valid CouchDB operators in the selector.
    Set count=true to return the number of matching results, rather than the results themselves.
    If the query is not correct, an error message will be returned.
    If an error is returned, rewrite the query, check the query, and try again.
    The default result limit is ${this.getConfig().defaultParams.limit}`
  }

  public getConfig(): BaseQueryToolConfig {
    return this.config
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

      // Ensure we have the schema so we can convert to correct RAG context string
      fields.push('schema')

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

      return convertRecordsToRAGContext(result, this.tokenLimit)

    } catch (error) {
      console.error(error)
      return `${error}`;
    }
  }

}