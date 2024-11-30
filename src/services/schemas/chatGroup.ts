import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

class ChatGroupDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.CHAT_GROUP
    }

    public getRagContent(row: any): string {
        return `Group Name: ${row.name}\nDescription: ${row.description}\nURL: ${row.uri}\nSource: ${row.sourceApplication}})\n\n`
    }

    public getName(): string {
        return "ChatGroup"
    }
    
    public getLabel(): string {
        return "Chat Group"
    }
    
    public getDescription(): string {
        return "my chat groups"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'name', 'description', 'insertedAt']
    }
    
    public getIndexFields(): string[] {
        return ['name','description','insertedAt']
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['name', 'description', 'uri', 'insertedAt'],
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
                    "description": "Name of the chat group",
                    "type": "string",
                },
                "description": {
                    "title": "Description",
                    "description": "Description of the chat group",
                    "type": "string",
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

export default new ChatGroupDataSchema()