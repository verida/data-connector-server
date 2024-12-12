import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

class ChatMessageDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.CHAT_MESSAGE
    }

    public getRagContent(row: any): string {
        return `[ Chat Message ]\nID: ${row._id}\nMessage Text: ${row.messageText}\nType (send/receive): ${row.type}\nFrom: ${row.fromName} (${row.fromHandle})\nGroup: ${row.groupName || "" }(${row.groupId})\nSource: ${row.sourceApplication}\nSent At: ${row.sentAt}\n\n`
    }

    public getName(): string {
        return "ChatMessage"
    }

    public getGroupId(row: any): string {
        return row.groupId
    }

    public getTimestamp(row: any): string {
        return row.sentAt
    }
    
    public getLabel(): string {
        return "Chat Message"
    }
    
    public getDescription(): string {
        return "my chat messages"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'groupId', 'sentAt']
    }
    
    public getIndexFields(): string[] {
        return ['messageText', 'fromHandle', 'fromName', 'groupName', 'groupId', 'indexableText', 'sentAt','sourceApplication']
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['_id', 'messageText', 'type', 'fromHandle', 'fromName', 'groupName', 'sentAt', 'sourceApplication'],
            sort: [{ "sentAt": "desc" }]
        }
    }
    
    public getQuerySchemaString(): string {
        return `
{
    "groupId": {
        "title": "Chat Group ID",
        "type": "string"
    },
    "groupName": {
        "title": "Chat Group Name",
        "type": "string"
    },
    "type": {
        "title": "Type",
        "description": "Type of message (send, receive)",
        "type": "string",
        "enum": ["send", "receive"]
    },
    "messageText": {
        "title": "Message (Text)",
        "type": "string"
    },
    "messageHTML": {
        "title": "Message (HTML)",
        "type": "string"
    },
    "fromId": {
        "title": "From ID",
        "type": "string"
    },
    "fromHandle": {
        "title": "From Handle",
        "type": "string"
    },
    "fromName": {
        "title": "From Name",
        "type": "string"
    },
    "sentAt": {
        "title": "Sent at",
        "type": "string",
        "format": "date-time"
    },
  "sourceApplication": {
            "title": "Source application",
            "description": "Name of the application this data was sourced from",
            "type": "string"
    }
}
`;
    }

}

export default new ChatMessageDataSchema()