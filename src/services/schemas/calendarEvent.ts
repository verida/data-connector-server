import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

class CalendarEventDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.EVENT
    }

    public getRagContent(row: any): string {
        return `Type: Calendar Event\nName: ${row.name}\nDescription: ${row.description}\nStatus: ${row.status}\nCreator: ${JSON.stringify(row.creator)}\nAttendees: ${JSON.stringify(row.attendees)}\nLocation: ${row.location}\nStart: ${row.start.dateTime}\nSource: ${row.sourceApplication}})\n\n`
    }

    public getName(): string {
        return "CalendarEvent"
    }
    
    public getLabel(): string {
        return "Calendar Event"
    }
    
    public getDescription(): string {
        return "my calendar events"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'insertedAt', "start.dateTime"]
    }
    
    public getIndexFields(): string[] {
        // @todo: Support indexing attachments, creator, organizer and attendees
        return ['name', 'description', 'location', 'status', "modifiedAt", "insertedAt", "start.dateTime"]
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['name', 'status', 'description', 'calendarId', 'location', 'creator', 'start', 'end'],
            sort: [{ "start.dateTime": "desc" }]
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
    },
    "$defs": {
        "person": {
            "type": "object",
            "title": "Person",
            "description": "Schema representing a person",
            "properties": {
                "email": {
                    "type": "string",
                    "format": "email",
                    "description": "Email address of the person"
                },
                "displayName": {
                    "type": "string",
                    "description": "Display name of the person"
                }
            },
            "required": ["email"]
        }
    }
}
`;
    }

}

export default new CalendarEventDataSchema()