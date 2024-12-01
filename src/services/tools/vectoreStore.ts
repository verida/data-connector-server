import { Tool } from "@langchain/core/tools";
import { IContext } from "@verida/types";
import { DataService } from "../data";
// import { BaseQueryToolConfig, CouchDBQuerySchemaType } from "../../services/interfaces";

export class VectoreStoreTool extends Tool {
  private context: IContext

  name = "VectoreStore"
  description = `Input to this tool is a search string that will be sent to a vector database to find related emails, attachments, chat messages, files, documents, calendar events and social media posts.`

  constructor(context: IContext) {
    super()
    this.context = context
  }

  public async _call(searchString: string) {
    console.log('vector store called:', searchString)

    const account = this.context.getAccount()
    const did = await account.did()
    const dataService = new DataService(did, this.context)

    const vectorStore = await dataService.getVectorStore()
    const docs = await vectorStore.similaritySearch(searchString, 20)
    return JSON.stringify(docs)
  }

}