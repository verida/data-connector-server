import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import { BaseHandlerConfig, SyncItemsBreak, SyncItemsResult, SyncProviderLogEvent, SyncProviderLogLevel } from '../../interfaces'
import { google, gmail_v1 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker"

import {
  SyncResponse,
  SyncHandlerStatus,
  ProviderHandlerOption,
  ConnectionOptionType,
} from "../../interfaces";
import { SchemaEmail, SchemaEmailType, SchemaRecord } from "../../schemas";
import { GmailHelpers } from "./helpers";
import { GmailSyncSchemaPosition, GoogleHandlerConfig } from "./interfaces";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";

const _ = require("lodash");

const MAX_BATCH_SIZE = 500

export interface SyncEmailItemsResult extends SyncItemsResult {
  items: SchemaEmail[]
}

export default class Gmail extends GoogleHandler {

  protected config: GoogleHandlerConfig

  public getLabel(): string {
    return "Gmail"
  }

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
  
  public getOptions(): ProviderHandlerOption[] {
    return [{
      id: 'backdate',
      label: 'Backdate history',
      type: ConnectionOptionType.ENUM,
      enumOptions: [{
        value: '1-month',
        label: '1 month'
      }, {
        value: '3-months',
        label: '3 months'
      }, {
        value: '6-months',
        label: '6 months'
      }, {
        value: '12-months',
        label: '12 months'
      }],
      defaultValue: '3-months'
    }]
  }

  public async _sync(
    api: any,
    syncPosition: GmailSyncSchemaPosition
  ): Promise<SyncResponse> {
    try {
      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`)
      }

      const gmail = this.getGmail();
      // Range tracker is used where completed startId = item ID, endId = pageToken
      // And conversely, pending startId = page token, endId = item ID
      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef)

      let items: SchemaEmail[] = []

      /**
       * Fetch any new items
       */
      // Current range has `startId` = undefined, `endId` = breakId
      let currentRange = rangeTracker.nextRange()

      let query: gmail_v1.Params$Resource$Users$Messages$List = {
        userId: "me",
        maxResults: this.config.batchSize, // default = 100, max = 500
      };

      if (currentRange.startId) {
        query.pageToken = currentRange.startId
      }

      const latestResponse = await gmail.users.messages.list(query);
      const latestResult = await this.buildResults(
        gmail,
        latestResponse,
        currentRange.endId,
        _.has(this.config, "breakTimestamp")
          ? this.config.breakTimestamp as string
          : undefined
      );

      items = latestResult.items

      let nextPageToken = _.has(latestResponse, "data.nextPageToken") ? latestResponse.data.nextPageToken : undefined

      if (items.length) {
        rangeTracker.completedRange({
          startId: items[0].sourceId,
          endId: nextPageToken
        }, latestResult.breakHit == SyncItemsBreak.ID)
      } else {
        rangeTracker.completedRange({
          startId: undefined,
          endId: undefined
        }, false) // No results and first batch, so break ID couldn't have been hit
      }

      currentRange = rangeTracker.nextRange();
      if (items.length != this.config.batchSize && currentRange.startId) {
        // Not enough items, fetch more from the next page of results
        query = {
          userId: "me",
          maxResults: this.config.batchSize - items.length, // only fetch enough items needed to complete the batch size
          pageToken: currentRange.startId
        };

        const backfillResponse = await gmail.users.messages.list(query);
        const backfillResult = await this.buildResults(
          gmail,
          backfillResponse,
          currentRange.endId,
          _.has(this.config, "breakTimestamp")
            ? this.config.breakTimestamp
            : undefined
        );

        items = items.concat(backfillResult.items)

        nextPageToken = _.has(backfillResponse, "data.nextPageToken") ? backfillResponse.data.nextPageToken : undefined
    
        if (backfillResult.items.length) {
          rangeTracker.completedRange({
            startId: backfillResult.items[0].sourceId,
            endId: nextPageToken
          }, backfillResult.breakHit == SyncItemsBreak.ID)
        } else {
          rangeTracker.completedRange({
            startId: undefined,
            endId: undefined
          },  backfillResult.breakHit == SyncItemsBreak.ID)
        }
      }

      if (!items.length) {
        syncPosition.syncMessage = `Stopping. No results found.`
        syncPosition.status = SyncHandlerStatus.ENABLED
      } else {
        if (items.length != this.config.batchSize && !nextPageToken) {
          syncPosition.syncMessage = `Processed ${items.length} items. Stopping. No more results.`
          syncPosition.status = SyncHandlerStatus.ENABLED
        } else {
          syncPosition.syncMessage = `Batch complete (${this.config.batchSize}). More results pending.`
        }
      }

      syncPosition.thisRef = rangeTracker.export()

      return {
        results: items,
        position: syncPosition,
      };
    } catch (err: any) {
      if (err.status == 403) {
          throw new AccessDeniedError(err.message)
      } else if (err.status == 401 && err.errors[0].reason == 'authError') {
        throw new InvalidTokenError(err.message)
      }

      throw err
  }
  }

  protected async buildResults(
    gmail: gmail_v1.Gmail,
    serverResponse: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>,
    breakId: string,
    breakTimestamp?: string
  ): Promise<SyncEmailItemsResult> {
    const results: SchemaEmail[] = [];
    let breakHit: SyncItemsBreak
    for (const message of serverResponse.data.messages) {
      const messageId = message.id;

      if (messageId == breakId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId})`
        }
        this.emit('log', logEvent)
        breakHit = SyncItemsBreak.ID
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
        breakHit = SyncItemsBreak.TIMESTAMP
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

      let messageType = SchemaEmailType.RECEIVE
      if (from.email == this.connection.profile.email) {
        messageType = SchemaEmailType.SEND
      }

      results.push({
        _id: this.buildItemId(messageId),
        type: messageType,
        name: subject ? subject : 'No email subject',
        sourceAccountId: this.provider.getAccountId(),
        sourceData: {},
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: message.id,
        fromName: from.name,
        fromEmail: from.email,
        toEmail: to.email,
        toName: to.name,
        messageText: text ? text : 'No email body',
        messageHTML: html ? html : 'No email body',
        sentAt: internalDate,
        insertedAt: internalDate,
        threadId,
        attachments,
      });
    }

    return {
      items: results,
      breakHit
    }
  }
}
