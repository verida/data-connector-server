import { Client as NotionClient } from "@notionhq/client";
import { AccessRecord } from "./types";

import serverconfig from '../../../../config'
import { getAccessRecord, updateLatestAccess, updateLatestAccessForDid } from "./utils";

export class Service {
  constructor() {
    // Move the Notion client as a class instance property
  }

  public async getAccessRecord(did: string): Promise<AccessRecord | undefined> {
    try {
      if (!serverconfig.notion.apiKey) {
        console.warn("Notion API key is not set")
        // TODO: Use dedicated Error for missing config property
        throw new Error("Notion API key is not set")
      }

      // For now and unknowing the restart policy after crash, instantiating
      // the Notion client in the function scope to be caught in the catch block
      const notionClient = new NotionClient({
        auth: serverconfig.notion.apiKey,
      })

      const record = await getAccessRecord(notionClient, did)

      return record
    } catch (error: unknown) {
      // TODO: Update tsconfig target to allow passing a cause to the Error
      throw new Error("Something went wrong checking user access")
    }
  }

  public async updateLatestAccessForDid(did: string): Promise<void> {
    try {
      if (!serverconfig.notion.apiKey) {
        console.warn("Notion API key is not set")
        // TODO: Use dedicated Error for missing config property
        throw new Error("Notion API key is not set")
      }

      // For now and unknowing the restart policy after crash, instantiating
      // the Notion client in the function scope to be caught in the catch block
      const notionClient = new NotionClient({
        auth: serverconfig.notion.apiKey,
      })

      await updateLatestAccessForDid(notionClient, did, new Date())
    } catch (error: unknown) {
      // TODO: Update tsconfig target to allow passing a cause to the Error
      throw new Error("Something went wrong updating the latest access")
    }
  }

  public async updateLatestAccess(accessRecord: AccessRecord): Promise<void> {
    try {
      if (!serverconfig.notion.apiKey) {
        console.warn("Notion API key is not set")
        // TODO: Use dedicated Error for missing config property
        throw new Error("Notion API key is not set")
      }

      // For now and unknowing the restart policy after crash, instantiating
      // the Notion client in the function scope to be caught in the catch block
      const notionClient = new NotionClient({
        auth: serverconfig.notion.apiKey,
      })

      await updateLatestAccess(notionClient, accessRecord, new Date())
    } catch (error: unknown) {
      // TODO: Update tsconfig target to allow passing a cause to the Error
      throw new Error("Something went wrong updating the latest access")
    }
  }
}
