import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";
// import Imap from 'node-imap'
// import { simpleParser } from 'mailparser'
import { google, gmail_v1 } from "googleapis";
import { GaxiosResponse } from "gaxios";

import {
  SyncResponse,
  SyncSchemaPosition,
  SyncHandlerStatus,
  HandlerOption,
} from "../../interfaces";
import { SchemaEmail, SchemaEmailType } from "../../schemas";
import { GmailHelpers } from "./helpers";
import { GmailSyncSchemaPosition } from "./interfaces";

const _ = require("lodash");

export default class Gmail extends BaseSyncHandler {

  public getName(): string {
    return 'gmail'
}

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.EMAIL;
  }

  public getProviderApplicationUrl() {
    return 'https://gmail.com/'
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
  
  public getOptions(): HandlerOption[] {
    return [{
      name: 'backdate',
      label: 'Backdate history',
      type: 'enum',
      enumOptions: ['1 month', '3 months', '6 months', '12 months'],
      defaultValue: '3 months'
  }]
  }

  public async _sync(
    api: any,
    syncPosition: GmailSyncSchemaPosition
  ): Promise<SyncResponse> {
    const gmail = this.getGmail();

    const query: gmail_v1.Params$Resource$Users$Messages$List = {
      userId: "me",
      maxResults: this.config.batchSize, // Google Docs: default = 100, max = 500
    };

    if (syncPosition.thisRef) {
      query.pageToken = syncPosition.thisRef;
    }

    const serverResponse = await gmail.users.messages.list(query);

    if (
      !_.has(serverResponse, "data.messages") ||
      !serverResponse.data.messages.length
    ) {
      // No results found, so stop sync
      syncPosition = this.stopSync(syncPosition);

      return {
        position: syncPosition,
        results: [],
      };
    }

    const results = await this.buildResults(
      gmail,
      serverResponse,
      syncPosition.breakId,
      SchemaEmailType.RECEIVE,
      _.has(this.config, "metadata.breakTimestamp")
        ? this.config.metadata.breakTimestamp
        : undefined
    );

    syncPosition = this.setNextPosition(syncPosition, serverResponse);

    if (results.length != this.config.batchSize) {
      // Not a full page of results, so stop sync
      syncPosition = this.stopSync(syncPosition);
    }

    return {
      results,
      position: syncPosition,
    };
  }

  protected stopSync(syncPosition: SyncSchemaPosition): SyncSchemaPosition {
    if (syncPosition.status == SyncHandlerStatus.STOPPED) {
      return syncPosition;
    }

    syncPosition.status = SyncHandlerStatus.STOPPED;
    syncPosition.thisRef = undefined;
    syncPosition.breakId = syncPosition.futureBreakId;
    syncPosition.futureBreakId = undefined;

    return syncPosition;
  }

  protected setNextPosition(
    syncPosition: SyncSchemaPosition,
    serverResponse: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>
  ): SyncSchemaPosition {
    if (!syncPosition.futureBreakId && serverResponse.data.messages.length) {
      syncPosition.futureBreakId = `${this.connection.profile.id}-${serverResponse.data.messages[0].id}`;
    }

    if (_.has(serverResponse, "data.nextPageToken")) {
      // Have more results, so set the next page ready for the next request
      syncPosition.thisRef = serverResponse.data.nextPageToken;
    } else {
      syncPosition = this.stopSync(syncPosition);
    }

    return syncPosition;
  }

  protected async buildResults(
    gmail: gmail_v1.Gmail,
    serverResponse: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>,
    breakId: string,
    messageType: SchemaEmailType,
    breakTimestamp?: string
  ): Promise<SchemaEmail[]> {
    const results: SchemaEmail[] = [];
    for (const message of serverResponse.data.messages) {
      const messageId = `${this.connection.profile.id}-${message.id}`;

      if (messageId == breakId) {
        break;
      }

      const msg = await GmailHelpers.getMessage(gmail, message.id);
      const internalDate = msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : "Unknown";

      if (breakTimestamp && internalDate < breakTimestamp) {
        break;
      }

      const text = GmailHelpers.getTextContent(msg.payload);
      const html = GmailHelpers.getHtmlContent(msg.payload);
      const subject = GmailHelpers.getHeader(msg.payload?.headers, "Subject");
      const from = GmailHelpers.parseEmail(
        GmailHelpers.getHeader(msg.payload?.headers, "From")
      );
      const to = GmailHelpers.parseEmail(
        GmailHelpers.getHeader(msg.payload?.headers, "To")
      );
      const threadId = msg.threadId || "Unknown";
      const attachments = await GmailHelpers.getAttachments(gmail, msg);

      results.push({
        _id: `gmail-${messageId}`,
        type: messageType,
        name: subject ? subject : 'No email subject',
        sourceAccountId: this.provider.getProviderId(),
        sourceData: {},
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: message.id,
        fromName: from.name,
        fromEmail: from.email,
        toEmail: to.name,
        messageText: text ? text : 'No email body',
        messageHTML: html ? html : 'No email body',
        sentAt: internalDate,
        insertedAt: internalDate,
        threadId,
        attachments,
      });
    }

    return results;
  }
}
