import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import { SyncProviderLogEvent, SyncProviderLogLevel } from '../../interfaces'
import { google, gmail_v1 } from "googleapis";
import { GaxiosResponse } from "gaxios";

import {
  SyncResponse,
  SyncHandlerPosition,
  SyncHandlerStatus,
  HandlerOption,
  ConnectionOptionType,
} from "../../interfaces";
import { SchemaEmail, SchemaEmailType } from "../../schemas";
import { GmailHelpers } from "./helpers";
import { GmailSyncSchemaPosition } from "./interfaces";

const _ = require("lodash");

export default class Gmail extends GoogleHandler {

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
    const oAuth2Client = this.getGoogleAuth()

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    return gmail;
  }
  
  public getOptions(): HandlerOption[] {
    return [{
      name: 'backdate',
      label: 'Backdate history',
      type: ConnectionOptionType.ENUM,
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
      syncPosition.syncMessage = `Stopping. No results found.`
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
      syncPosition.syncMessage = `Processed ${results.length} items. Stopping. No more results.`
      syncPosition = this.stopSync(syncPosition);
    }

    return {
      results,
      position: syncPosition,
    };
  }

  protected stopSync(syncPosition: SyncHandlerPosition): SyncHandlerPosition {
    if (syncPosition.status == SyncHandlerStatus.ENABLED) {
      return syncPosition;
    }

    syncPosition.status = SyncHandlerStatus.ENABLED;
    syncPosition.thisRef = undefined;
    syncPosition.breakId = syncPosition.futureBreakId;
    syncPosition.futureBreakId = undefined;

    return syncPosition;
  }

  protected setNextPosition(
    syncPosition: SyncHandlerPosition,
    serverResponse: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>
  ): SyncHandlerPosition {
    if (!syncPosition.futureBreakId && serverResponse.data.messages.length) {
      syncPosition.futureBreakId = serverResponse.data.messages[0].id;
    }

    if (_.has(serverResponse, "data.nextPageToken")) {
      syncPosition.syncMessage = `Batch complete (${this.config.batchSize}). More results pending.`
      syncPosition.thisRef = serverResponse.data.nextPageToken;
    } else {
      syncPosition.syncMessage = `Stopping. No more results.`
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
      const messageId = message.id;

      if (messageId == breakId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId})`
        }
        this.emit('log', logEvent)
        break;
      }

      const msg = await GmailHelpers.getMessage(gmail, message.id);
      const internalDate = msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : "Unknown";

      if (breakTimestamp && internalDate < breakTimestamp) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break timestamp hit (${breakTimestamp})`
        }
        this.emit('log', logEvent)
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
        _id: this.buildItemId(messageId),
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
