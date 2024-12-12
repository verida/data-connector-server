import { BaseDataSchema } from "./base";
import CONFIG from "../../config"
import { CouchDBQuerySchemaType } from "../interfaces";
import { SorensenDiceSimilarity, DefaultTextParser, Summarizer, AbsoluteSummarizerConfig, NullLogger } from "ts-textrank";
const sanitizeHtml = require('sanitize-html');

const MAX_EMAIL_LENGTH = 5000
const MAX_ATTACHMENT_LENGTH = 5000
const SUMMARIZER_SENTENCE_COUNT = 10

class EmailDataSchema implements BaseDataSchema {

    protected summarizer?: Summarizer

    public getUrl(): string {
        return CONFIG.verida.schemas.EMAIL
    }

    public getTimestamp(row: any): string {
        return row.sentAt
    }

    public getGroupId(row: any): string | undefined {
        return undefined
    }

    public getBodyText(row: any): string {
        let body = sanitizeHtml(row.messageText, { allowedTags: []})

        if (body.length > MAX_EMAIL_LENGTH) {
            const lang = "en"
            const summarizer = this.getSummarizer()
            body = summarizer.summarize(body, lang).join(" ")
            body = `[ This is a summary of a long email with ID ${row._id} ] ${body}`
        }

        if (row.attachments) {
            for (const attachment of row.attachments) {
                body += attachment.textContent!.substring(0, MAX_ATTACHMENT_LENGTH)
            }
        }

        return body
    }

    public getRagContent(row: any): string {
        return `[ Email ]\nID: ${row._id}\nSubject: ${row.name}\nTo: ${row.toName} <${row.toEmail}>\nFrom: ${row.fromName} <${row.fromEmail}>\nSent Date/time: ${row.sentAt}\nSource: ${row.sourceApplication}\nBody: ${this.getBodyText(row)}\n\n`
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
            fields: ['_id', 'name', 'type', 'fromName', 'fromEmail', 'messageText', 'sentAt', 'sourceApplication'],
            sort: [{ "sentAt": "desc" }]
        }
    }

    protected getSummarizer() {
        if (this.summarizer) {
            return this.summarizer
        }

        //Only one similarity function implemented at this moment.
        //More could come in future versions.
        const sim = new SorensenDiceSimilarity()

        //Only one text parser available a this moment
        const parser = new DefaultTextParser()

        //Do you want logging?
        // const logger = new ConsoleLogger()
        const logger = new NullLogger()

        //You can implement LoggerInterface for different behavior,
        //or if you don't want logging, use this:
        //const logger = new NullLogger()

        //Set the summary length as a percentage of full text length
        const ratio = .25 

        //Damping factor. See "How it works" for more info.
        const d = .85

        //How do you want summary sentences to be sorted?
        //Get sentences in the order that they appear in text:
        const sorting = Summarizer.SORT_OCCURENCE
        //Or sort them by relevance:
        //const sorting = Summarizer.SORT_SCORE
        // const config = new RelativeSummarizerConfig(ratio, sim, parser, d, sorting)

        //Or, if you want a fixed number of sentences:
        //const number = 5
        const config = new AbsoluteSummarizerConfig(SUMMARIZER_SENTENCE_COUNT, sim, parser, d, sorting)    

        const summarizer = new Summarizer(config, logger)

        this.summarizer = summarizer
        return summarizer
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

export default new EmailDataSchema()