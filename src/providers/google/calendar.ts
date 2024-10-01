import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import { SyncHandlerPosition, SyncItemsBreak, SyncItemsResult, SyncProviderLogEvent, SyncProviderLogLevel } from '../../interfaces';
import { google, calendar_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";

import {
  SyncResponse,
  SyncHandlerStatus,
  ProviderHandlerOption,
  ConnectionOptionType,
} from "../../interfaces";
import { SchemaCalendar } from "../../schemas";
import { CalendarHelpers } from "./helpers";

const _ = require("lodash");

// Set MAX_BATCH_SIZE to 250 because the Google Calendar API v3 'maxResults' parameter is capped at 250.
// For more details, see: https://developers.google.com/calendar/api/v3/reference/calendarList/list 
const MAX_BATCH_SIZE = 250;

export interface SyncCalendarItemsResult extends SyncItemsResult {
  items: SchemaCalendar[];
}

export default class Calendar extends GoogleHandler {

  public getName(): string {
    return 'calendar';
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.CALENDAR;
  }

  public getProviderApplicationUrl() {
    return 'https://calendar.google.com/';
  }

  public getCalendar(): calendar_v3.Calendar {
    const oAuth2Client = this.getGoogleAuth();
    return google.calendar({ version: "v3", auth: oAuth2Client });
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
    }];
  }

  public async _sync(
    api: any,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    if (this.config.batchSize > MAX_BATCH_SIZE) {
      throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
    }

    const calendar = this.getCalendar();
    const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);

    let items: SchemaCalendar[] = [];

    // Fetch any new items
    let currentRange = rangeTracker.nextRange();
    let query: calendar_v3.Params$Resource$Calendarlist$List = {
      maxResults: this.config.batchSize,
    };

    if (currentRange.startId) {
      query.pageToken = currentRange.startId;
    }

    const latestResponse = await calendar.calendarList.list(query);
    const latestResult = await this.buildResults(
      calendar,
      latestResponse,
      currentRange.endId
    );

    items = latestResult.items;

    let nextPageToken = _.has(latestResponse, "data.nextPageToken") ? latestResponse.data.nextPageToken : undefined;

    if (items.length) {
      rangeTracker.completedRange({
        startId: items[0].sourceId,
        endId: nextPageToken
      }, latestResult.breakHit == SyncItemsBreak.ID);
    } else {
      rangeTracker.completedRange({
        startId: undefined,
        endId: undefined
      }, false);
    }

    if (items.length != this.config.batchSize) {
      currentRange = rangeTracker.nextRange();
      query = {
        maxResults: this.config.batchSize - items.length,
      };

      if (currentRange.startId) {
        query.pageToken = currentRange.startId;
      }

      const backfillResponse = await calendar.calendarList.list(query);
      const backfillResult = await this.buildResults(
        calendar,
        backfillResponse,
        currentRange.endId
      );

      items = items.concat(backfillResult.items);
      nextPageToken = _.has(backfillResponse, "data.nextPageToken") ? backfillResponse.data.nextPageToken : undefined;

      if (backfillResult.items.length) {
        rangeTracker.completedRange({
          startId: backfillResult.items[0].sourceId,
          endId: nextPageToken
        }, backfillResult.breakHit == SyncItemsBreak.ID);
      } else {
        rangeTracker.completedRange({
          startId: undefined,
          endId: undefined
        }, backfillResult.breakHit == SyncItemsBreak.ID);
      }
    }

    if (!items.length) {
      syncPosition.syncMessage = `Stopping. No results found.`;
      syncPosition.status = SyncHandlerStatus.ENABLED;
    } else {
      if (items.length != this.config.batchSize && !nextPageToken) {
        syncPosition.syncMessage = `Processed ${items.length} items. Stopping. No more results.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage = `Batch complete (${this.config.batchSize}). More results pending.`;
      }
    }

    syncPosition.thisRef = rangeTracker.export();

    return {
      results: items,
      position: syncPosition,
    };
  }

  protected async buildResults(
    calendar: calendar_v3.Calendar,
    serverResponse: GaxiosResponse<calendar_v3.Schema$CalendarList>,
    breakId: string
  ): Promise<SyncCalendarItemsResult> {
    const results: SchemaCalendar[] = [];
    let breakHit: SyncItemsBreak;

    for (const listItem of serverResponse.data.items) {
      const calendarId = listItem.id;
      
      if (!calendarId) {
        const logEvent: SyncProviderLogEvent = {
            level: SyncProviderLogLevel.DEBUG,
            message: `Invalid calendar ID. Ignoring this calendar.`,
        };
        this.emit('log', logEvent);
        continue;
      }
      
      if (calendarId == breakId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId})`
        };
        this.emit('log', logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }

      const summary = listItem.summary ?? 'No calendar title';
      let timeZone = listItem.timeZone;

      if (!timeZone) {
        const logEvent: SyncProviderLogEvent = {
            level: SyncProviderLogLevel.DEBUG,
            message: `Invalid timezone for calendar ${calendarId}. Ignoring this calendar.`,
        };
        this.emit('log', logEvent);
        continue;
      }
      
      timeZone = CalendarHelpers.getUTCOffsetTimezone(timeZone);

      const description = listItem.description ?? 'No description';
      const location = listItem.location ?? 'No location';
      const insertedAt = new Date().toISOString(); // Adding insertedAt field

      results.push({
        _id: this.buildItemId(calendarId),
        name: summary,
        sourceAccountId: this.provider.getAccountId(),
        sourceData: listItem,
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: calendarId,
        timezone: timeZone,
        description,
        location,
        insertedAt,  // insertedAt field
      });
    }

    return {
      items: results,
      breakHit
    };
  }
}
