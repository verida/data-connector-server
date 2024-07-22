import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";
// import Imap from 'node-imap'
// import { simpleParser } from 'mailparser'
import { google, dataportability_v1 } from "googleapis";
import { GaxiosResponse } from "gaxios";

import {
  SyncResponse,
  SyncSchemaPosition,
  SyncHandlerStatus,
} from "../../interfaces";
import { SchemaEmail, SchemaEmailType, SchemaRecord } from "../../schemas";
import { GmailHelpers } from "../google/helpers";

const _ = require("lodash");

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default class DataPortability extends BaseSyncHandler {
  public getSchemaUri(): string {
    return CONFIG.verida.schemas.EMAIL;
  }

  

  public async _sync(
    api: any,
    syncPosition: SyncSchemaPosition
  ): Promise<SyncResponse> {
    const dpApi = this.getApi();

    dataportability_v1.Resource$Portabilityarchive

    try {
        // See https://developers.google.com/data-portability/reference/rest/v1/portabilityArchive/initiate
        const initiateResponse = await dpApi.portabilityArchive.initiate({
            requestBody: {
                resources: ["https://www.googleapis.com/auth/dataportability.myactivity.search"]
            }
        })
        console.log(initiateResponse.data)

        //while (true) {
            console.log('sleeping for 10 seconds')
            await sleep(2000)
            const archiveState = await dpApi.archiveJobs.getPortabilityArchiveState({
                name: initiateResponse.data.archiveJobId
            }) 

            console.log(archiveState.data)
        //}
    } catch (err) {
        console.log(err)
    }

    const results: SchemaRecord[] = []

    return {
      results,
      position: syncPosition,
    };
  }

//   protected stopSync(syncPosition: SyncSchemaPosition): SyncSchemaPosition {
//     if (syncPosition.status == SyncHandlerStatus.STOPPED) {
//       return syncPosition;
//     }

//     syncPosition.status = SyncHandlerStatus.STOPPED;
//     syncPosition.thisRef = undefined;
//     syncPosition.breakId = syncPosition.futureBreakId;
//     syncPosition.futureBreakId = undefined;

//     return syncPosition;
//   }

//   protected setNextPosition(
//     syncPosition: SyncSchemaPosition,
//     serverResponse: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>
//   ): SyncSchemaPosition {
//     if (!syncPosition.futureBreakId && serverResponse.data.messages.length) {
//       syncPosition.futureBreakId = `${this.connection.profile.id}-${serverResponse.data.messages[0].id}`;
//     }

//     if (_.has(serverResponse, "data.nextPageToken")) {
//       // Have more results, so set the next page ready for the next request
//       syncPosition.thisRef = serverResponse.data.nextPageToken;
//     } else {
//       syncPosition = this.stopSync(syncPosition);
//     }

//     return syncPosition;
//   }

//   protected async buildResults(
//     gmail: gmail_v1.Gmail,
//     serverResponse: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>,
//     breakId: string,
//     messageType: SchemaEmailType,
//     breakTimestamp?: string
//   ): Promise<SchemaEmail[]> {
//     const results: SchemaEmail[] = [];
//     for (const message of serverResponse.data.messages) {
//       const messageId = `${this.connection.profile.id}-${message.id}`;

//       if (messageId == breakId) {
//         break;
//       }

//       const msg = await GmailHelpers.getMessage(gmail, message.id);
//       const internalDate = msg.internalDate
//         ? new Date(parseInt(msg.internalDate)).toISOString()
//         : "Unknown";

//       if (breakTimestamp && internalDate < breakTimestamp) {
//         break;
//       }

//       const text = GmailHelpers.getTextContent(msg.payload);
//       const html = GmailHelpers.getHtmlContent(msg.payload);
//       const subject = GmailHelpers.getHeader(msg.payload?.headers, "Subject");
//       const from = GmailHelpers.parseEmail(
//         GmailHelpers.getHeader(msg.payload?.headers, "From")
//       );
//       const to = GmailHelpers.parseEmail(
//         GmailHelpers.getHeader(msg.payload?.headers, "To")
//       );
//       const threadId = msg.threadId || "Unknown";
//       const attachments = await GmailHelpers.getAttachments(gmail, msg);

//       results.push({
//         _id: `gmail-${messageId}`,
//         type: messageType,
//         name: subject ? subject : 'No email subject',
//         sourceApplication: "https://gmail.com/",
//         sourceId: message.id,
//         fromName: from.name,
//         fromEmail: from.email,
//         toEmail: to.name,
//         messageText: text ? text : 'No email body',
//         messageHTML: html ? html : 'No email body',
//         sentAt: internalDate,
//         insertedAt: internalDate,
//         threadId,
//         attachments,
//       });
//     }

//     return results;
//   }
}
