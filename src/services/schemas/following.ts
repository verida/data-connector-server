import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

const MAX_DESCRIPTION = 255

class FollowingDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.FOLLOWING
    }

    public getRagContent(row: any): string {
        return `Following name: ${row.name}Description:\n${row.description?.substring(0, MAX_DESCRIPTION)}\nSource: ${row.sourceApplication})\n\n`
    }

    public getName(): string {
        return "Following"
    }
    
    public getLabel(): string {
        return "Social Following"
    }
    
    public getDescription(): string {
        return "who I follow on social media"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'name','uri','description','insertedAt','followedTimestamp']
    }
    
    public getIndexFields(): string[] {
        return ['name','description','sourceApplication']
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['name', 'uri', 'followedTimestamp'],
            sort: [{ "followedTimestamp": "desc" }]
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
        "description": "Name of who is followed",
        "type": "string",
    },
    "uri": {
        "title": "URI",
        "type": "string"
    },
    "followedTimestamp": {
        "title": "Followed timestamp",
        "type": "string",
        "format": "date-time"
    }
}
`;
    }

}

export default new FollowingDataSchema()