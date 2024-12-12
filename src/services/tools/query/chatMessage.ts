import { convertRecordsToRAGContext } from "../utils"
import { BaseQueryTool } from "./base"
import { SearchService } from "../../search"

export class ChatMessageQueryTool extends BaseQueryTool {

    protected async convertResult(result: any) {
        const did = await this.context.getAccount().did()
        const searchService = new SearchService(did, this.context)
        const chatMessages = await searchService.convertChatMessagesToThreads(result)

        const response = await convertRecordsToRAGContext(chatMessages, this.tokenLimit)
        return response
      }

}