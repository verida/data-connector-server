import { google, calendar_v3 } from "googleapis";
import GoogleHandler from "./GoogleHandler";
import CONFIG from "../../config";
import {
  SyncItemsResult,
  SyncResponse,
  SyncHandlerStatus,
  ProviderHandlerOption,
  ConnectionOptionType,
  SyncHandlerPosition,
  SyncProviderLogEvent,
  SyncProviderLogLevel,
  SyncItemsBreak
} from "../../interfaces";
import {
  SchemaCalendar,
  SchemaEvent,
} from "../../schemas";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { CalendarHelpers } from "./helpers";
import { CalendarAttachment, DateTimeInfo, GoogleCalendarHandlerConfig, Person } from "./interfaces";

const _ = require("lodash");

// Set MAX_BATCH_SIZE to 250 because the Google Calendar API v3 'maxResults' parameter is capped at 250.
// For more details, see: https://developers.google.com/calendar/api/v3/reference/calendarList/list 
const MAX_BATCH_SIZE = 250;

export interface SyncEventItemsResult extends SyncItemsResult {
  items: SchemaEvent[]
}
export default class CalendarEventHandler extends GoogleHandler {

  protected config: GoogleCalendarHandlerConfig;

  public getName(): string {
    return "calendar-event";
  }

  public getLabel(): string {
    return "Calendar Event";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.CALENDAR_EVENT;
  }

  public getProviderApplicationUrl(): string {
    return "https://calendar.google.com/"; // Change URL depending on provider (Google, Microsoft)
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

  public getCalendarClient(): calendar_v3.Calendar {
    const oAuth2Client = this.getGoogleAuth();
    return google.calendar({ version: "v3", auth: oAuth2Client });
  }

  protected async buildCalendarList(): Promise<SchemaCalendar[]> {
    const calendarClient = this.getCalendarClient();

    let calendarList: SchemaCalendar[] = [];

    let nextPageToken: string | undefined;
    let query: calendar_v3.Params$Resource$Calendarlist$List = {
      pageToken: nextPageToken,
    };

    // Loop through paginated results
    do {
      const response = await calendarClient.calendarList.list(query);

      for (const calendar of response.data.items || []) {
        // Extract essential details for the calendar entry
        const calendarId = calendar.id;

        if (!calendarId) {
          this.emit("log", {
            level: SyncProviderLogLevel.DEBUG,
            message: `Invalid calendar ID. Ignoring this calendar.`,
          });
          continue;
        }

        const summary = calendar.summary ?? "No title";
        let timeZone = calendar.timeZone;

        if (!timeZone) {
          this.emit("log", {
            level: SyncProviderLogLevel.DEBUG,
            message: `Invalid timezone for calendar ${calendarId}. Ignoring this calendar.`,
          });
          continue;
        }

        timeZone = CalendarHelpers.getUTCOffsetTimezone(timeZone);
        const description = calendar.description;
        const location = calendar.location;
        const insertedAt = new Date().toISOString();

        const group: SchemaCalendar = {
          _id: this.buildItemId(calendarId),
          name: summary,
          sourceAccountId: this.provider.getAccountId(),
          sourceApplication: this.getProviderApplicationUrl(),
          sourceId: calendarId,
          timezone: timeZone,
          description,
          location,
          insertedAt,
          sourceData: calendar,
          schema: CONFIG.verida.schemas.CALENDAR,
        };

        calendarList.push(group);
      }

      nextPageToken = response.data.nextPageToken; // Update the pageToken to fetch the next batch
      query.pageToken = nextPageToken;
    } while (nextPageToken);


    return calendarList;
  }

  public async _sync(
    api: any,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    try {
      const apiClient = this.getCalendarClient();
      let calendarList = await this.buildCalendarList(); // Fetch all personal, work, and shared calendars

      const calendarDs = await this.provider.getDatastore(CONFIG.verida.schemas.CALENDAR)
      const calendarDbItems = <SchemaCalendar[]>await calendarDs.getMany({
        "sourceAccountId": this.provider.getAccountId()
      });

      calendarList = calendarList.map((calendarItem) => {
        // Find the corresponding item in calendarDbItems by 'sourceId'
        const matchingDbItem = calendarDbItems.find(
          (dbItem) => dbItem.sourceId === calendarItem.sourceId
        );

        // If a matching item is found in calendarDbItems, merge them, retaining `syncData` field
        if (matchingDbItem) {
          return _.merge({}, matchingDbItem, calendarItem);
        }

        // If no matching item, return the calendarItem as is
        return calendarItem;
      });

      let totalEvents = 0;
      let eventHistory: SchemaEvent[] = [];

      // Iterate over each calendar
      for (let i = 0; i < calendarList.length; i++) {
        // Use a separate ItemsRangeTracker for each calendar
        let rangeTracker = new ItemsRangeTracker(calendarList[i].syncData);

        const fetchedEvents = await this.fetchAndTrackEvents(
          calendarList[i],
          rangeTracker,
          apiClient
        );

        // Concatenate the fetched events to the total event history
        eventHistory = eventHistory.concat(fetchedEvents);
       
        totalEvents += fetchedEvents.length;

        // Update the calendar's sync data with the latest rangeTracker state
        calendarList[i].syncData = rangeTracker.export();
      }

      // Finalize sync position and status based on event count
      this.updateSyncPosition(
        syncPosition,
        totalEvents,
        calendarList.length
      );

      return {
        results: calendarList.concat(eventHistory),
        position: syncPosition,
      };
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }

  public buildResult(calendarId: string, event: calendar_v3.Schema$Event): SchemaEvent {
    const eventId = event.id || "";

    const start: DateTimeInfo = {
      dateTime: event.start?.dateTime || `${event.start?.date}T00:00:00.000Z`
    };
    const end: DateTimeInfo = {
      dateTime: event.end?.dateTime || `${event.end?.date}T00:00:00.000Z`
    };

    // Check for a break based on timestamp
    const updatedTime = event.updated ? new Date(event.updated).toISOString() : new Date().toISOString();

    start.timeZone = CalendarHelpers.getUTCOffsetTimezone(event.start?.timeZone);
    end.timeZone = CalendarHelpers.getUTCOffsetTimezone(event.end?.timeZone);

    const creator: Person = {
      email: event.creator?.email,
      displayName: event.creator?.displayName
    };

    const organizer: Person = {
      email: event.organizer?.email,
      displayName: event.organizer?.displayName
    };

    let attendees: Person[] = [];
    if (event.attendees) {
      attendees = event.attendees.filter(attendee => attendee.email) as Person[];
    }

    const attachments: CalendarAttachment[] = event.attachments as CalendarAttachment[];

    const eventRecord: SchemaEvent = {
      _id: this.buildItemId(eventId),
      name: event.summary ?? "Unknown",
      sourceAccountId: this.provider.getAccountId(),
      sourceData: event,
      sourceApplication: this.getProviderApplicationUrl(),
      sourceId: eventId,
      schema: CONFIG.verida.schemas.EVENT,
      uri: event.htmlLink,
      calendarId: calendarId,
      start,
      end,
      creator,
      organizer,
      location: event.location,
      description: event.description,
      status: event.status,
      conferenceData: event.conferenceData,
      attendees,
      attachments,
      insertedAt: updatedTime
    }

    return eventRecord
  }

  private async buildResults(
    calendarId: string,
    response: calendar_v3.Schema$Events,
    breakId: string
  ): Promise<SyncEventItemsResult> {
    const results: SchemaEvent[] = [];
    let breakHit: SyncItemsBreak;

    for (const event of response.items || []) {
      const eventId = event.id || "";

      // Break if the event ID matches breakId
      if (eventId === breakId) {
        const logEvent: SyncProviderLogEvent = {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId}) in calendar (${calendarId})`
        };
        this.emit("log", logEvent);
        breakHit = SyncItemsBreak.ID;
        break;
      }

      const eventRecord = this.buildResult(calendarId, event)
      results.push(eventRecord);
    }

    return {
      items: results,
      breakHit
    };
  }

  private async fetchAndTrackEvents(
    calendar: SchemaCalendar,
    rangeTracker: ItemsRangeTracker,
    apiClient: calendar_v3.Calendar
  ): Promise<SchemaEvent[]> {
    if (!calendar || !calendar.sourceId) {
      throw new Error("Invalid calendar or missing calendar sourceId");
    }

    let items: SchemaEvent[];
    let currentRange = rangeTracker.nextRange();
    let query: calendar_v3.Params$Resource$Events$List = {
      calendarId: calendar.sourceId,
      maxResults: this.config.eventBatchSize,
      singleEvents: true
    };

    if (currentRange.startId) {
      query.pageToken = currentRange.startId;
    }

    // Fetch events from Google Calendar API
    const response = await apiClient.events.list(query);

    // Use buildResults to process the response
    const latestResult = await this.buildResults(
      calendar.sourceId,
      response.data,
      currentRange.endId
    );

    items = latestResult.items;
    // Update the range tracker
    if (items.length) {
      rangeTracker.completedRange(
        {
          startId: items[0].sourceId,
          endId: response.data?.nextPageToken
        },
        latestResult.breakHit == SyncItemsBreak.ID
      );
    } else {
      rangeTracker.completedRange({ startId: undefined, endId: undefined }, false);
    }

    currentRange = rangeTracker.nextRange();
    if (items.length != this.config.eventBatchSize && currentRange.startId) {
      // Not enough items, fetch more from the next page of results
      let query: calendar_v3.Params$Resource$Events$List = {
        calendarId: calendar.sourceId,
        maxResults: this.config.eventBatchSize - items.length,
        pageToken: currentRange.startId,
        singleEvents: true,
      };

      const backfillResponse = await apiClient.events.list(query);

      const backfillResult = await this.buildResults(
        calendar.sourceId,
        backfillResponse.data,
        currentRange.endId
      );

      items = items.concat(backfillResult.items)

      if (backfillResult.items.length) {
        rangeTracker.completedRange({
          startId: backfillResult.items[0].sourceId,
          endId: backfillResponse.data?.nextPageToken
        }, backfillResult.breakHit == SyncItemsBreak.ID)
      } else {
        rangeTracker.completedRange({
          startId: undefined,
          endId: undefined
        }, backfillResult.breakHit == SyncItemsBreak.ID)
      }
    }

    return items;
  }


  private updateSyncPosition(
    syncPosition: SyncHandlerPosition,
    totalEvents: number,
    calendarCount: number,
  ) {
    syncPosition.status = SyncHandlerStatus.SYNCING;
    syncPosition.syncMessage = `Batch complete (${totalEvents}) across (${calendarCount} calendars)`;
  }
}
