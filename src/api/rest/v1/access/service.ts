import { Client as NotionClient } from "@notionhq/client";
import { RestrictedAccessStatus } from "./types";

import serverconfig from '../../../../config'

export class Service {
  constructor() {
    // Move the Notion client as a class instance property
  }

  public async getAccess(did: string): Promise<RestrictedAccessStatus> {
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
      });

      if (!serverconfig.notion.restrictedAccessDatabaseId) {
        console.warn("Notion restricted access database ID is not set")
        // TODO: Use dedicated Error for missing config property
        throw new Error("Notion restricted access database ID is not set")
      }

      const response = await notionClient.databases.query({
        database_id: serverconfig.notion.restrictedAccessDatabaseId,
        filter: {
          property: "DID",
          rich_text: {
            equals: did,
          },
        },
      })

      const isAllowed = response.results.length > 0

      // TODO: Check for an access property in the Notion record so we can save
      // some DIDs on waitlist in this DB and grant them access simply with a
      // property update

      return isAllowed ? "allowed" : "denied"
    } catch (error) {
      // TODO: Update tsconfig target to allow passing a cause to the Error
      throw new Error("Something went wrong checking user access")
    }
  }
}
