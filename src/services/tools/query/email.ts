import { BaseQueryTool, BaseQueryToolConfig } from "./base";
import CONFIG from "../../../config"

export class EmailQueryTool extends BaseQueryTool {

    name = "EmailQuery"

    protected getConfig(): BaseQueryToolConfig {
        return {
            defaultParams: {
                fields: ['name', 'type', 'fromName', 'fromEmail', 'messageText', 'sentAt'],
                sort: [{ "sentAt": "desc" }]
            },
            schemaUrl: CONFIG.verida.schemas.EMAIL,
            schemaDefinition: `
{
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
`
        }
    }

}