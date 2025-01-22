import MiniSearch from "minisearch";
import * as CryptoJS from "crypto-js";

import { DataService, indexCache } from "./data";

import { IContext } from "@verida/types";
import { Utils } from "../utils";

export interface SearchResultItem {
  id: string
  terms: string[]
  queryTerms: string[]
  match: object
  score: number
}

export interface MinisearchServiceSearchResult {
  results: SearchResultItem[];
  count: number;
}

// @todo: support updating the index when the datastore changes

export class MinisearchService {
  public static async searchDs(
    context: IContext,
    did: string,
    schemaName: string,
    query: string,
    searchOptions: object = {},
    indexFields: string[],
    storeFields: string[] = [],
    limit: number = 20,
    permissions: Record<string, string> = {},
  ): Promise<MinisearchServiceSearchResult> {
    // console.log(
    //   `Searching for ${query} in ${schemaName} with index ${indexFields}`
    // );

    const searchService = new DataService(did, context)
    const results = await searchService.searchIndex(schemaName, query, limit, undefined, searchOptions, indexFields, storeFields)

    return {
      results: results.slice(0, limit),
      count: results.length,
    };
  }
}
