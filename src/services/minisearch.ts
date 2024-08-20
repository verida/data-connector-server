import MiniSearch from "minisearch";
import * as CryptoJS from "crypto-js";

import { indexCache } from "./data";

import { IContext } from "@verida/types";
import { Utils } from "../utils";

export interface MinisearchServiceSearchResult {
  results: object[];
  count: number;
}

// @todo: support updating the index when the datastore changes

export class MinisearchService {
  public static async searchDs(
    context: IContext,
    did: string,
    schemaName: string,
    query: string,
    indexFields: string[],
    storeFields: string[] = [],
    limit: number = 20,
    permissions: Record<string, string> = {},
  ): Promise<MinisearchServiceSearchResult> {
    console.log(
      `Searching for ${query} in ${schemaName} with index ${indexFields}`
    );

    const cacheKey = CryptoJS.MD5(
      `${did}:${schemaName}:${indexFields.join(",")}:${storeFields.join(",")}`
    ).toString();

    console.log("cacheKey", cacheKey);

    if (!indexCache[cacheKey]) {
      // console.time('Opening datastore')
      const datastore = await context.openDatastore(schemaName, {
        // @ts-ignore
        permissions,
      });

      console.log("Fetching data");
      const database = await datastore.getDb();
      const db = await database.getDb();
      const result = await db.allDocs({
        include_docs: true,
        attachments: false,
      });

      // Build a list of array properties to index separately
      const schema = datastore.getSchema();
      const schemaSpec = await schema.getSpecification();

      const arrayProperties = [];
      for (const propertyKey of Object.keys(schemaSpec.properties)) {
        const property = schemaSpec.properties[propertyKey];

        if (property.type == "array") {
          arrayProperties.push(propertyKey);
        }
      }

      // If no store fields specified, store everything
      if (storeFields.length === 0) {
        storeFields = Object.keys(schemaSpec.properties);
      }

      const docs: any = [];
      for (const i in result.rows) {
        const row = result.rows[i].doc;
        // Ignore PouchDB design rows
        if (row._id.match("_design")) {
          continue;
        }

        row.id = row._id;
        delete row["_id"];

        // Flatten array fields for indexing
        for (const arrayProperty of arrayProperties) {
          if (row[arrayProperty] && row[arrayProperty].length) {
            let i = 0;
            for (const arrayItem of row[arrayProperty]) {
              if (!arrayItem.filename.match("pdf")) {
                continue;
              }

              const arrayItemProperty = `${arrayProperty}_${i}`;
              row[arrayItemProperty] = arrayItem;

              // Make sure this field is stored
              if (storeFields.indexOf(arrayItemProperty) === -1) {
                storeFields.push(arrayItemProperty);
              }

              // @todo: Make sure the original field isn't stored (`arrayProperty`)

              console.log(
                arrayItem.filename,
                arrayItem.textContent.substring(0, 100)
              );
              i++;
            }
          }
        }

        docs.push(row);
      }

      console.log("Creating index", indexFields, storeFields);
      const miniSearch = new MiniSearch({
        fields: indexFields, // fields to index for full-text search
        storeFields,
        // Add support for nested fields (`ie: attachments_0.textContent)
        extractField: (document: any, fieldName: string) => {
          return fieldName
            .split(".")
            .reduce((doc, key) => doc && doc[key], document);
        },
      });

      // Index all documents
      miniSearch.addAll(docs);

      indexCache[cacheKey] = miniSearch;
    } else {
      console.log("cache match!");
    }

    console.log("Searching...");
    const results = indexCache[cacheKey].search(query);

    return {
      results: results.slice(0, limit),
      count: results.length,
    };
  }
}
