// import { Tool } from "@langchain/core/tools";
// import { IContext } from "@verida/types";
// import { DataService } from "../data";

// export class VectoreStoreTool extends Tool {
//   private context: IContext

//   name = "VectoreStore"
//   description = `This tool will search a vector database to find related emails, attachments, chat messages, files, documents, calendar events and social media posts.
//   Input to this tool is a JSON object with two properties; searchString (keywords to search), filter (JSON filter to apply to the search results with the following fields available; id, .timestamp, type, groupId)
//   `

//   constructor(context: IContext) {
//     super()
//     this.context = context
//   }

//   public async _call(args: string) {
//     try {
//       const params = JSON.parse(args)
//       const searchString = params.searchString
//       // const filter = params.filter || {}

//       const account = this.context.getAccount()
//       const did = await account.did()
//       const dataService = new DataService(did, this.context)

//       const vectorStore = await dataService.getVectorStore()
//       const docs = await vectorStore.similaritySearch(searchString, 20)
//       return JSON.stringify(docs)
//     } catch (err: any) {
//       console.error(err)
//       return err.message
//     }
//   }

// }