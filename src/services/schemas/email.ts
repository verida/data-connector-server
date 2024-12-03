import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";

const MAX_EMAIL_LENGTH = 10000
const MAX_ATTACHMENT_LENGTH = 10000

class EmailDataSchema implements BaseDataSchema {

    public getUrl(): string {
        return CONFIG.verida.schemas.EMAIL
    }

    public getTimestamp(row: any): string {
        return row.sentAt
    }

    public getGroupId(row: any): string | undefined {
        return undefined
    }

    public getRagContent(row: any): string {
        let body = row.messageText.substring(0, MAX_EMAIL_LENGTH)
        if (row.attachments) {
            for (const attachment of row.attachments) {
                body += attachment.textContent!.substring(0, MAX_ATTACHMENT_LENGTH)
            }
        }

        return `Subject: ${row.name}\nTo: ${row.toName} <${row.toEmail}>\nFrom: ${row.fromName} <${row.fromEmail}>\nSent Date/time: ${row.sentAt}\nSource: ${row.sourceApplication}\nBody: ${body}\n\n`
    }

    public getName(): string {
        return "Email"
    }
    
    public getLabel(): string {
        return "Email"
    }
    
    public getDescription(): string {
        return "my emails"
    }
    
    public getStoreFields(): string[] {
        return ['_id', 'sentAt']
    }
    
    public getIndexFields(): string[] {
        return ['name','fromName','fromEmail','messageText','attachments_0.textContent','attachments_1.textContent','attachments_2.textContent', 'indexableText', 'sentAt','sourceApplication']
    }
    
    public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
        return {
            fields: ['name', 'type', 'fromName', 'fromEmail', 'messageText', 'sentAt'],
            sort: [{ "sentAt": "desc" }]
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
      "description": "Email subject",
      "type": "string"
  },
  "type": {
      "title": "Type",
      "description": "Type of message (send, receive)",
      "type": "string",
      "enum": ["send", "receive"]
  },
  "fromName": {
      "title": "From Name",
      "description": "Name of email sender",
      "type": "string"
  },
  "fromEmail": {
      "title": "From Email",
      "description": "Email address of sender",
      "type": "string"
  },
  "messageText": {
      "title": "Message (Text)",
      "description": "Message content of the email as text",
      "type": "string"
  },
  "messageHTML": {
      "title": "Message (HTML)",
      "description": "Message content of the email as HTML",
      "type": "string"
  },
  "sentAt": {
      "title": "Source data",
      "type": "string",
      "format": "date-time"
  }
}
`;
    }

}

export default new EmailDataSchema()