import BaseSyncHandler from "../BaseSyncHandler";
import { createXOAuth2Generator } from "xoauth2";
import CONFIG from "../../config";
// import Imap from 'node-imap'
// import { simpleParser } from 'mailparser'
import { google, gmail_v1 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { OAuth2Client } from "google-auth-library";

import {
  SyncResponse,
  SyncSchemaPosition,
  SyncHandlerStatus,
} from "../../interfaces";
import { SchemaEmail, SchemaEmailType } from "../../schemas";
import { GmailHelpers } from "./helpers";

const _ = require("lodash");

export default class Email extends BaseSyncHandler {
  protected apiEndpoint = "/me/likes";

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.EMAIL;
  }

  public getGmail(): gmail_v1.Gmail {
    const TOKEN = {
      access_token: this.connection.accessToken,
      refresh_token: this.connection.refreshToken,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      token_type: "Bearer",
    };

    const redirectUrl = "";

    const oAuth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      redirectUrl
    );

    oAuth2Client.setCredentials(TOKEN);
    
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    return gmail;
  }

  public async _sync(
    api: any,
    syncPosition: SyncSchemaPosition
  ): Promise<SyncResponse> {
    const gmail = this.getGmail();

    const serverResponse = await gmail.users.messages.list({
      userId: "me",
      maxResults: this.config.batchSize,
    });

    const results = await this.buildResults(
      gmail,
      serverResponse,
      syncPosition.breakId,
      SchemaEmailType.RECEIVE
    );

    // syncPosition.status = SyncHandlerStatus.STOPPED
    // return {
    //     results: [],
    //     position: syncPosition
    // }
    // if (!syncPosition.thisRef) {
    //     syncPosition.thisRef = `${this.apiEndpoint}?limit=${this.config.followingBatchSize}`
    // }

    // const pageResults = await Fb.api(syncPosition.thisRef)

    // if (!pageResults || !pageResults.data.length) {
    //     // No results found, so stop sync
    //     syncPosition = this.stopSync(syncPosition)

    //     return {
    //         position: syncPosition,
    //         results: []
    //     }
    // }

    // const results = this.buildResults(pageResults.data, syncPosition.breakId)
    // syncPosition = this.setNextPosition(syncPosition, pageResults)

    // if (results.length != this.config.postBatchSize) {
    //     // Not a full page of results, so stop sync
    //     syncPosition = this.stopSync(syncPosition)
    // }

    return {
      results,
      position: syncPosition,
    };
  }

  protected stopSync(syncPosition: SyncSchemaPosition): SyncSchemaPosition {
    return syncPosition;
    // if (syncPosition.status == SyncHandlerStatus.STOPPED) {
    //     return syncPosition
    // }

    // syncPosition.status = SyncHandlerStatus.STOPPED
    // syncPosition.thisRef = undefined
    // syncPosition.breakId = syncPosition.futureBreakId
    // syncPosition.futureBreakId = undefined

    // return syncPosition
  }

  protected setNextPosition(
    syncPosition: SyncSchemaPosition,
    serverResponse: any
  ): SyncSchemaPosition {
    return syncPosition;
    // if (!syncPosition.futureBreakId && serverResponse.data.length) {
    //     syncPosition.futureBreakId = serverResponse.data[0].id
    // }

    // if (_.has(serverResponse, 'paging.next')) {
    //     // Have more results, so set the next page ready for the next request
    //     const next = serverResponse.paging.next
    //     const urlParts = url.parse(next, true)
    //     syncPosition.thisRef = `${this.apiEndpoint}${urlParts.search}`
    // } else {
    //     console.log('following: stopping, no next page')
    //     syncPosition = this.stopSync(syncPosition)
    // }

    // return syncPosition
  }

  protected async buildResults(
    gmail: gmail_v1.Gmail,
    serverResponse: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>,
    breakId: string,
    messageType: SchemaEmailType
  ): Promise<SchemaEmail[]> {
    const results: SchemaEmail[] = [];
    for (const message of serverResponse.data.messages) {
      if (message.id == breakId) {
        break;
      }

      const msg = await GmailHelpers.getMessage(gmail, message.id);
      const text = GmailHelpers.getTextContent(msg.payload);
      const html = GmailHelpers.getHtmlContent(msg.payload);
      const subject = GmailHelpers.getHeader(msg.payload?.headers, "Subject");
      const from = GmailHelpers.parseEmail(
        GmailHelpers.getHeader(msg.payload?.headers, "From")
      );
      const to = GmailHelpers.parseEmail(
        GmailHelpers.getHeader(msg.payload?.headers, "To")
      );
      const internalDate = msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : "Unknown";
      const threadId = msg.threadId || "Unknown";
      const attachments = await GmailHelpers.getAttachments(gmail, msg);

      results.push({
        _id: `gmail-${this.connection.profile.id}-${message.id}`,
        type: messageType,
        name: subject,
        sourceApplication: "https://gmail.com/",
        sourceId: message.id,
        fromName: from.name,
        fromEmail: from.email,
        toEmail: to.name,
        messageText: text,
        messageHTML: html,
        sentAt: internalDate,
        threadId,
        attachments,
      });
    }

    return results;
  }
}
