import { Request } from "express";
import { Client as NotionClient } from "@notionhq/client";
import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { AccessRecord } from "./types";
import { NotionDatabaseProperty } from "./notion-types";
import { getValueFromNotionCheckboxProperty, getValueFromNotionTitleProperty } from "./notion-utils";
import { NotionError } from "./notion-error";
import { isValidVeridaDid } from "../../../../utils";
import { BadRequestError } from "../../../../errors/bad-request-error";
import serverconfig from '../../../../config'

/**
 * Extracts the DID from the request parameters.
 *
 * @param req The request object.
 * @returns The DID.
 * @throws {BadRequestError} If the DID is invalid.
 */
export function extractDidFromRequestParams(req: Request): string {
  const did = req.params.did;

  const isValid = isValidVeridaDid(did);
  if (isValid) {
    return did;
  }

  throw new BadRequestError("Invalid DID parameter in request");
}


export async function getAccessRecord(notionClient: NotionClient, did: string): Promise<AccessRecord | undefined> {
  if (!serverconfig.notion.restrictedAccessDatabaseId) {
    console.warn("Notion restricted access database ID is not set")
    // TODO: Use dedicated Error for missing config property
    throw new Error("Notion restricted access database ID is not set")
  }

  try {

    const response = await notionClient.databases.query({
      database_id: serverconfig.notion.restrictedAccessDatabaseId,
      filter: {
        property: "DID",
        rich_text: {
          equals: did,
        },
      },
    })

    if (response.results.length === 0) {
      return undefined;
    }

    const record = response.results[0] as DatabaseObjectResponse;

    const accessRecord = transformNotionRecordToAccessRecord(record);

    return accessRecord;
  } catch (error: unknown) {
    throw new NotionError("Error while querying the database")
  }
}

export function transformNotionRecordToAccessRecord(record: DatabaseObjectResponse): AccessRecord {
  // HACK: Surprisingly the Notion library types don't correspond to the
  // actual data structure returned by the API, so we need to cast it
  const properties = record.properties as unknown as Record<
    string,
    NotionDatabaseProperty
    >;

  return {
    id: record.id,
    did: getValueFromNotionTitleProperty(properties["DID"]),
    admin: getValueFromNotionCheckboxProperty(properties["Admin"]),
    access: true,
  }
}
