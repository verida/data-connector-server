import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

class PostDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.POST
    }

    public getTimestamp(row: any): string {
        return row.insertedAt
    }

    public getGroupId(row: any): string | undefined {
        return undefined
    }

    public getRagContent(row: any): string {
        return `Name: ${row.name}\nType: ${row.type}\nContent: ${row.content}\nURL: ${row.uri}\nSource: ${row.fromName} (${row.fromHandle}) via ${row.sourceApplication}})\n\n`
    }

    public getName(): string {
        return "SocialPost"
    }
    
    public getLabel(): string {
        return "Social Post"
    }
    
    public getDescription(): string {
        return "my social media posts"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'name','content','type','uri','insertedAt']
    }
    
    public getIndexFields(): string[] {
        return ['name', 'content', 'indexableText','sourceApplication']
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['name', 'type', 'content', 'uri'],
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
        "description": "Name of post",
        "type": "string",
    },
    {
    "type": {
        "title": "Type",
        "description": "Type of post",
        "type": "string",
        "enum": ["link", "status", "photo", "video", "music", "event", "offer", "question", "note", "album", "life_event"]
    },
    "content": {
        "title": "Content",
        "description": "Content of the post",
        "type": "string"
    },
    "contentHtml": {
        "title": "Content (html)",
        "description": "HTML formatted version of the post",
        "type": "string"
    },
    "uri": {
        "title": "URI",
        "type": "string"
    },
    "insertedAt": {
        "title": "Inserted",
        "description": "Date/time this record was inserted",
        "type": "string",
        "format": "date-time"
    }
}
`;
    }

}

export default new PostDataSchema()