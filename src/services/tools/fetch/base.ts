import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { BaseFetchToolConfig } from "../../../services/interfaces";

export class BaseFetchTool extends Tool {
  private context: IContext
  private config: BaseFetchToolConfig

  name = ""
  description = ""

  constructor(context: IContext, config: BaseFetchToolConfig) {
    super()
    this.context = context
    this.config = config
    this.description = `Input to this tool is an array of "ID" properties to fetch from the ${this.name} database.`
  }

  public getConfig(): BaseFetchToolConfig {
    return this.config
  }

  /** @ignore */
  public async _call(recordIdArgs: string) {
    const recordIds = JSON.parse(recordIdArgs)

    const config = this.getConfig()

    try {
      const db = await this.context.openDatastore(config.schemaUrl)

      const result = await db.getMany({
        _id: {
            "$in": recordIds
        }
      }, {})

      return JSON.stringify(result)
    } catch (error) {
      console.error(error)
      return `${error}`;
    }
  }

}