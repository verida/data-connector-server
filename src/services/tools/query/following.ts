import { BaseQueryTool, BaseQueryToolConfig } from "./base";
import CONFIG from "../../../config"

export class FollowingQueryTool extends BaseQueryTool {

    name = "FollowingQuery"

    protected getConfig(): BaseQueryToolConfig {
        return {
            defaultParams: {
                fields: ['name', 'uri', 'followedTimestamp'],
                sort: [{ "followedTimestamp": "desc" }]
            },
            schemaUrl: CONFIG.verida.schemas.FOLLOWING,
            extraDetail: "who I follow on social media",
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
`
        }
    }

}