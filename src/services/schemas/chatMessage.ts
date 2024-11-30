// import { BaseDataSchema } from "./base";
// import CONFIG from "../../config"
// import { CouchDBQuerySchemaType } from "../interfaces";

// class ChatGroupDataSchema implements BaseDataSchema {

//     public getUrl(): string {
//         return CONFIG.verida.schemas.CHAT_MESSAGE
//     }

//     public getRagContent(row: any): string {
//         throw new Error('not implemented')
//     }
    
//     public getLabel(): string {
//         return "Chat Message"
//     }
    
//     public getDescription(): string {
//         return "my chat messages"
//     }
    
//     public getStoreFields(): string[] {
//         return ['_id', 'groupId', 'sentAt']
//     }
    
//     public getIndexFields(): string[] {
//         return ['messageText', 'fromHandle', 'fromName', 'groupName', 'indexableText', 'sentAt','sourceApplication']
//     }
    
//     public getDefaultQueryParams(): Partial<CouchDBQuerySchemaType> {
//         return {
//             fields: ['name', 'description', 'uri', 'insertedAt'],
//             sort: [{ "insertedAt": "desc" }]
//         }
//     }
    
//     public getQuerySchemaString(): string {
//         return `
// {
//                 "_id": {
//                     "title": "ID",
//                     "description": "Unique ID of this record",
//                     "type": "string",
//                 },
//                 "name": {
//                     "title": "Name",
//                     "description": "Name of the chat group",
//                     "type": "string",
//                 },
//                 "description": {
//                     "title": "Description",
//                     "description": "Description of the chat group",
//                     "type": "string",
//                 },
//                 "uri": {
//                     "title": "URI",
//                     "type": "string"
//                 },
//                 "insertedAt": {
//                     "title": "Inserted",
//                     "description": "Date/time this record was inserted",
//                     "type": "string",
//                     "format": "date-time"
//                 }
//             }
// `;
//     }

// }

// export default new ChatGroupDataSchema()