import { BaseQueryTool, BaseQueryToolConfig } from "./base";
import CONFIG from "../../../config"

export class FileQueryTool extends BaseQueryTool {

    name = "FileQuery"

    protected getConfig(): BaseQueryToolConfig {
        return {
            defaultParams: {
                fields: ['name', 'size', 'contextText', 'uri', 'extension', 'mimeType', 'insertedAt'],
                sort: [{ "insertedAt": "desc" }]
            },
            schemaUrl: CONFIG.verida.schemas.FILE,
            extraDetail: "files and documents",
            schemaDefinition: `
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
`
        }
    }

}