import { BaseQueryTool, BaseQueryToolConfig } from "./base";
import CONFIG from "../../../config"

export class ChatGroupQueryTool extends BaseQueryTool {

    name = "ChatGroupQuery"

    protected getConfig(): BaseQueryToolConfig {
        return {
            defaultParams: {
                fields: ['_id', 'name', 'uri', 'insertedAt'],
                sort: [{ "insertedAt": "desc" }]
            },
            schemaUrl: CONFIG.verida.schemas.CHAT_GROUP,
            extraDetail: "chat groups",
            schemaDefinition: `
{
                "_id": {
                    "title": "ID",
                    "description": "Unique ID of this record",
                    "type": "string",
                },
                "name": {
                    "title": "Name",
                    "description": "Name of the calendar event",
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
`
        }
    }

}