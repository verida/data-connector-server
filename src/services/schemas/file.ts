import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

const MAX_FILE_LENGTH = 10000

class FileDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.FILE
    }

    public getRagContent(row: any): string {
        return `File name: ${row.name}\nFile content:${row.contentText.substring(0, MAX_FILE_LENGTH)}\nSource:${row.sourceApplication})\n\n`
    }
    
    public getName(): string {
        return "File"
    }

    public getLabel(): string {
        return "File"
    }
    
    public getDescription(): string {
        return "my files and documents"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'insertedAt']
    }
    
    public getIndexFields(): string[] {
        return ['name', 'contentText', 'indexableText', 'sourceApplication', "modifiedAt", "insertedAt"]
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['name', 'size', 'contextText', 'uri', 'extension', 'mimeType', 'insertedAt'],
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
        "name": "File name",
        "type": "string",
        "description": "File name"
    },
    "extension": {
        "title": "Extension",
        "type": "string",
        "description": "File extension of the document (ie: png)"
    },
    "mimeType": {
        "title": "MIME Type",
        "type": "string",
        "description": "MIME type of the file"
    },
    "size": {
        "title": "Size",
        "type": "integer",
        "description": "Size of the document in bytes"
    },
    "contentText": {
        "title": "Content (Text)",
        "type": "string",
        "description": "Text content of the file (if relevant)"
    },
    "uri": {
        "title": "URI",
        "type": "string",
        "description": "External link to the document (optional)"
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

export default new FileDataSchema()