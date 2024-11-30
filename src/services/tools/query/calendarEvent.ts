import { BaseQueryTool, BaseQueryToolConfig } from "./base";
import CONFIG from "../../../config"

// "FOLLOWING": "https://common.schemas.verida.io/social/following/v0.1.0/schema.json",
//             "POST": "https://common.schemas.verida.io/social/post/v0.1.0/schema.json",
//             "EMAIL": "https://common.schemas.verida.io/social/email/v0.1.0/schema.json",
//             "FAVOURITE": "https://common.schemas.verida.io/favourite/v0.1.0/schema.json",
//             "FILE": "https://common.schemas.verida.io/file/v0.1.0/schema.json",
//             "CHAT_GROUP": "https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json",
//             "CHAT_MESSAGE": "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json",
//             "CALENDAR": "https://common.schemas.verida.io/social/calendar/v0.1.0/schema.json",
//             "EVENT": "https://common.schemas.verida.io/social/event/v0.1.0/schema.json"

export class CalendarEventQueryTool extends BaseQueryTool {

    name = "CalendarEventQuery"

    protected getConfig(): BaseQueryToolConfig {
        return {
            defaultParams: {
                fields: ['name', 'status', 'description', 'calendarId', 'location', 'creator', 'start', 'end'],
                sort: [{ "start.dateTime": "desc" }]
            },
            schemaUrl: CONFIG.verida.schemas.EVENT,
            extraDetail: "calendar events",
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
                "status": {
                    "title": "Status",
                    "description": "Status of the event",
                    "type": "string",
                    "enum": ["confirmed", "tentative", "cancelled"]
                },
                "description": {
                    "title": "Description",
                    "description": "Detailed description of the event",
                    "type": "string"
                },
                "calendarId": {
                    "description": "Reference ID for the calendar object",
                    "type": "string"
                },
                "uri": {
                    "title": "URI",
                    "type": "string"
                },
                "location": {
                    "title": "Location",
                    "description": "Location of the event",
                    "type": "string"
                },
                "creator": {
                    "title": "Creator",
                    "description": "Details of the event creator",
                    "$ref": "#/$defs/person"
                },
                "organizer": {
                    "title": "Organizer",
                    "description": "Details of the event organizer",
                    "$ref": "#/$defs/person"
                },
                "start": {
                    "title": "Start",
                    "description": "Start time of the event",
                    "type": "object",
                    "properties": {
                        "dateTime": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "timezone": {
                            "type": "string",
                            "description": "UTC offset format",
                            "pattern": "^([+-](?:2[0-3]|[01][0-9]):[0-5][0-9])$",
                            "examples": ["+02:30"]
                        }
                    },
                    "required": ["dateTime"]
                },
                "end": {
                    "title": "End",
                    "description": "End time of the event",
                    "type": "object",
                    "properties": {
                        "dateTime": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "timezone": {
                            "type": "string",
                            "description": "UTC offset format",
                            "pattern": "^([+-](?:2[0-3]|[01][0-9]):[0-5][0-9])$",
                            "examples": ["+02:30"]
                        }                        
                    },
                    "required": ["dateTime"]
                },
                "attendees": {
                    "title": "Attendees",
                    "description": "List of attendees for the event",
                    "type": "array",
                    "items": {
                        "$ref": "#/$defs/person"
                    }
                },
                "conferenceData": {
                    "title": "Conference Data",
                    "description": "Details about the conference associated with the event",
                    "type": "object"
                },
                "attachments": {
                    "title": "Attachments",
                    "description": "Attachments for the event",
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "fileUrl": {
                                "type": "string",
                                "format": "uri"
                            },
                            "title": {
                                "type": "string"
                            },
                            "mimeType": {
                                "type": "string"
                            },
                            "iconLink": {
                                "type": "string",
                                "format": "uri"
                            },
                            "fileId": {
                                "type": "string"
                            }
                        }
                    }
                }
            }
`
        }
    }

}