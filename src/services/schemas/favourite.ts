import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

class FavouriteDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.FAVOURITE
    }

    public getTimestamp(row: any): string {
        return row.insertedAt
    }

    public getTimestampField(): string {
        return "insertedAt"
    }

    public getGroupId(row: any): string | undefined {
        return undefined
    }

    public getRagContent(row: any): string {
        return `[ Favourite ]\nID: ${row._id}\nName: ${row.name}\nFavourite Type: ${row.favouriteType}\nContent Type: ${row.contentType}\nDescription: ${row.description || ""}\nURI: ${row.uri}\nSource: ${row.sourceApplication}\nInserted: ${row.insertedAt}\n\n`
    }

    public getName(): string {
        return "Favourite"
    }
    
    public getLabel(): string {
        return "Favourite"
    }
    
    public getDescription(): string {
        return "my favourites"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'insertedAt']
    }
    
    public getIndexFields(): string[] {
        return ['name', 'favouriteType', 'uri', 'contentType', 'description','sourceApplication']
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['_id', 'name', 'favouriteType', 'uri', 'contentType', 'description','sourceApplication', 'insertedAt'],
            sort: [{ "insertedAt": "desc" }]
        }
    }
    
    public getQuerySchemaString(): string {
        return `
{
    "_id": {
        "title": "ID",
        "description": "Unique ID of this record",
        "type": "string",
    },
  "name": {
      "title": "Name",
      "description": "Favourite name / label",
      "type": "string"
  },
   "favouriteType": {
        "title": "Favourite Type",
        "description": "Type of favourite",
        "type": "string",
        "enum": ["like", "favourite", "recommendation", "share"]
    },
    "contentType": {
        "title": "Content Type",
        "description": "Type of post",
        "type": "string",
        "enum": ["video", "audio", "document", "webpage"]
    },
    "uri": {
        "title": "URI",
        "type": "string"
    },
  "insertedAt": {
      "title": "Source data",
      "type": "string",
      "format": "date-time"
  },
  "sourceApplication": {
            "title": "Source application",
            "description": "Name of the application this data was sourced from",
            "type": "string"
    }
}
`;
    }

}

export default new FavouriteDataSchema()