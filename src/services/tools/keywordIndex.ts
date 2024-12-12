import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { SearchService } from "../search";
import { convertRecordsToRAGContext } from "./utils"
// import { BaseQueryToolConfig, CouchDBQuerySchemaType } from "../../services/interfaces";

export class KeywordIndexTool extends Tool {
  private context: IContext
  private tokenLimit: number

  name = "KeywordIndex"
  description = `This tool will search a keyword database to find relevant data.
  Input to this tool is a JSON object with the following properties:
{
  "properties": {
    "searchTypes": {
        "type": "array",
        "items": {
            "type": "string"
        }
        "description": "Array of data types to include in the search results",
        "enum": ["files", "messages", "emails", "favorites", "followed_pages", "posts", "calendar"]
    },
    "keywordsList": {
        "type": "array",
        "items": {
            "type": "string"
        }
        "description": "Array of keywords to search matching data"
    },
    "timeFrame": {
        "type": "string",
        "description": "Specify the timeframe of what data should be included"
        "enum": ["day", "week", "month", "quarter", "half-year", "full-year", "all"]
    },
    "limit: {
        "type": "string",
        "description": "Limit the number of result documents"
    }
  },
  "required": ["searchTypes", "keywordsList", "timeFrame", "limit"]
}
`

  constructor(context: IContext, tokenLimit: number = 100000) {
    super()
    this.context = context
    this.tokenLimit = tokenLimit
  }

  public async _call(args: string) {
    try {
      const params = JSON.parse(args)

      const searchTypes = params.searchTypes
      const keywordsList = params.keywordsList
      const timeFrame = params.timeFrame
      const resultLimit = params.resultLimit || 20
      const tokenLimit = params.tokenLimit || this.tokenLimit

      const account = this.context.getAccount()
      const did = await account.did()
      const dataService = new SearchService(did, this.context)

      const results = await dataService.multiByKeywords(searchTypes, keywordsList, timeFrame, resultLimit, true)

      return convertRecordsToRAGContext(results, tokenLimit)

    } catch (err: any) {
      console.error(err)
      return err.message
    }
  }

}