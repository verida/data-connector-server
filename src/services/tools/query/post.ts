import { BaseQueryTool, BaseQueryToolConfig } from "./base";
import CONFIG from "../../../config"

export class PostQueryTool extends BaseQueryTool {

    name = "PostQuery"

    protected getConfig(): BaseQueryToolConfig {
        return {
            defaultParams: {
                fields: ['name', 'type', 'content', 'uri'],
                sort: [{ "insertedAt": "desc" }]
            },
            schemaUrl: CONFIG.verida.schemas.POST,
            extraDetail: "social media posts I have made",
            schemaDefinition: `
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
`
        }
    }

}