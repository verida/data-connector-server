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
import { SchemaEvent } from "../../schemas";
import { CalendarAttachment, DateTimeInfo, Person } from "./interfaces";
import { CalendarHelpers } from "./helpers";

const _ = require("lodash");

// Set MAX_BATCH_SIZE to 2500 because the Google Calendar API v3 'maxResults' parameter is capped at 2500.
// For more details, see: https://developers.google.com/calendar/api/v3/reference/events/list 
const MAX_BATCH_SIZE = 2500;

export interface SyncCalendarItemsResult extends SyncItemsResult {
  items: SchemaEvent[];
}

export default class CalendarEvent extends GoogleHandler {

  public getName(): string {
    return 'calendar-event';
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.EVENT;
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

    let items: SchemaEvent[] = [];

    // Fetch any new items
    let currentRange = rangeTracker.nextRange();

    let query: calendar_v3.Params$Resource$Events$List = {
      calendarId: 'primary',
      maxResults: this.config.batchSize, // default = 250, max = 2500
      singleEvents: true,
      orderBy: "startTime",
    };

    if (currentRange.startId) {
      query.pageToken = currentRange.startId;
    }

    const latestResponse = await calendar.events.list(query);
    const latestResult = await this.buildResults(
      calendar,
      latestResponse,
      currentRange.endId,
      this.config.breakTimestamp ?? undefined
    );

    items = latestResult.items;

    let nextPageToken = latestResponse.data.nextPageToken ?? undefined;

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
        calendarId: 'primary',
        maxResults: this.config.batchSize - items.length,
        singleEvents: true,
        orderBy: "startTime",
      };

      if (currentRange.startId) {
        query.pageToken = currentRange.startId;
      }

      const backfillResponse = await calendar.events.list(query);
      const backfillResult = await this.buildResults(
        calendar,
        backfillResponse,
        currentRange.endId,
        this.config.breakTimestamp ?? undefined
      );

      items = items.concat(backfillResult.items);

      nextPageToken = backfillResponse.data.nextPageToken ?? undefined;

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
    serverResponse: GaxiosResponse<calendar_v3.Schema$Events>,
    breakId: string,
    breakTimestamp?: string
  ): Promise<SyncCalendarItemsResult> {
    const results: SchemaEvent[] = [];
    let breakHit: SyncItemsBreak;

    for (const event of serverResponse.data.items) {
      const eventId = event.id ?? '';

      if (eventId == breakId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId})`
        };
        this.emit('log', logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }

      let start: DateTimeInfo = {
        dateTime: event.start?.dateTime
      };
      let end: DateTimeInfo = {
        dateTime: event.end?.dateTime
      };

      start.dateTime = event.start?.dateTime;
      end.dateTime = event.end?.dateTime;

      if (!start.dateTime) {
        const logEvent: SyncProviderLogEvent = {
            level: SyncProviderLogLevel.DEBUG,
            message: `Invalid date for the event ${eventId}. Ignoring this event.`,
        };
        this.emit('log', logEvent);
        continue;
      }

      // UTC offset time zone
      start.timeZone = CalendarHelpers.getUTCOffsetTimezone(event.start?.timeZone)
      end.timeZone = CalendarHelpers.getUTCOffsetTimezone(event.end?.timeZone)

      if (breakTimestamp && start.dateTime < breakTimestamp) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break timestamp hit (${breakTimestamp})`
        };
        this.emit('log', logEvent);
        breakHit = SyncItemsBreak.TIMESTAMP;
        break;
      }

      const insertedAt = new Date().toISOString();

      const creator: Person = {
        email: event.creator.email ?? 'info@example.com',
        displayName: event.creator.displayName
      }

      const organizer: Person = {
        email: event.organizer.email ?? 'info@example.com',
        displayName: event.organizer.displayName
      }

      let attendees: Person[] = []
      if (event.attendees) {
        attendees = event.attendees.filter(attendee => attendee.email) as Person[];
      }

      const attachments: CalendarAttachment[] = event.attachments as CalendarAttachment[];

      results.push({
        _id: this.buildItemId(eventId),
        name: event.summary ?? 'No event title',
        sourceAccountId: this.provider.getProviderId(),
        sourceData: event,
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: eventId,
        calendarId: "primary",
        start,
        end,
        creator,
        organizer,
        location: event.location ?? 'No location',
        description: event.description ?? 'No description',
        status: event.status ?? 'Unkown',
        conferenceData: event.conferenceData,
        attendees,
        attachments,
        insertedAt
      });
    }

    return {
      items: results,
      breakHit
    };
  }
}
