import { google, calendar_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
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
  SyncProviderLogLevel
} from "../../interfaces";
import {
  SchemaCalendar,
  SchemaEvent,
} from "../../schemas";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import { ItemsRange } from "../../helpers/interfaces";
import { CalendarHelpers } from "./helpers";
import { CalendarAttachment, DateTimeInfo, GoogleCalendarHandlerConfig, Person } from "./interfaces";

const _ = require("lodash");

// Set MAX_BATCH_SIZE to 250 because the Google Calendar API v3 'maxResults' parameter is capped at 250.
// For more details, see: https://developers.google.com/calendar/api/v3/reference/calendarList/list 
const MAX_BATCH_SIZE = 250;
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
      maxResults: MAX_BATCH_SIZE,  // Fetch in batches up to the max limit
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

        const summary = calendar.summary ?? "No calendar title";
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
          timezone: timeZone ?? "Unkown",
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

  protected async fetchEventRange(
    calendar: SchemaCalendar,
    range: ItemsRange,
    apiClient: calendar_v3.Calendar
  ): Promise<SchemaEvent[]> {
    const events: SchemaEvent[] = [];

    let query: calendar_v3.Params$Resource$Events$List = {
      calendarId: calendar.sourceId,
      maxResults: this.config.eventsPerCalendarLimit,
      singleEvents: true,
      orderBy: "startTime"
    };

    if (range.startId && !isNaN(Date.parse(range.startId))) {
      query.timeMin = new Date(range.startId).toISOString();
    }

    if (range.endId && !isNaN(Date.parse(range.endId))) {
      query.timeMax = new Date(range.endId).toISOString();
    }

    // Fetch events from Google Calendar API
    const response = await apiClient.events.list(query);
    const items = response.data.items || [];

    for (const event of items) {
      const eventId = event.id ?? '';

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

      const insertedAt = new Date().toISOString();

      const creator: Person = {
        email: event.creator.email ?? "info@example.com",
        displayName: event.creator.displayName
      }

      const organizer: Person = {
        email: event.organizer.email ?? "info@example.com",
        displayName: event.organizer.displayName
      }

      let attendees: Person[] = []
      if (event.attendees) {
        attendees = event.attendees.filter(attendee => attendee.email) as Person[];
      }

      const attachments: CalendarAttachment[] = event.attachments as CalendarAttachment[];

      events.push({
        _id: this.buildItemId(eventId),
        name: event.summary ?? "Unknown",
        sourceAccountId: this.provider.getAccountId(),
        sourceData: event,
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: eventId,
        schema: CONFIG.verida.schemas.EVENT,
        calendarId: calendar.sourceId ?? "primary",
        start,
        end,
        creator,
        organizer,
        location: event.location,
        description: event.description,
        status: event.status ?? 'Unkown',
        conferenceData: event.conferenceData,
        attendees,
        attachments,
        insertedAt
      });

    }
    return events;
  }

  public async _sync(
    api: any,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    try {
      const apiClient = this.getCalendarClient();
      let calendarList = await this.buildCalendarList(); // Fetch all personal, work, and shared calendars

      console.log('==========Calendars from API========')
      console.log(calendarList)
      const calendarDs = await this.provider.getDatastore(CONFIG.verida.schemas.CALENDAR)
      const calendarDbItems = <SchemaCalendar[]>await calendarDs.getMany({
        "sourceAccountId": this.provider.getAccountId()
      });

      console.log('======Calendars from DB=====')
      console.log(calendarDbItems)
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

      console.log("========Calendars after Merge========")
      console.log(calendarList)

      let totalEvents = 0;
      let eventHistory: SchemaEvent[] = [];

      // Determine the current calendar position
      const calendarPosition = this.getCalendarPositionIndex(calendarList, syncPosition);

      const calendarCount = calendarList.length;

      // Iterate over each calendar
      for (let i = 1; i <= Math.min(calendarCount, this.config.calendarLimit); i++) {
        const calendarIndex = (calendarPosition + i) % calendarCount; // Rotate through calendars
        const calendar = calendarList[calendarIndex];

        // Use a separate ItemsRangeTracker for each calendar
        let rangeTracker = new ItemsRangeTracker(calendar.syncData);

        const fetchedEvents = await this.fetchAndTrackEvents(
          calendar,
          rangeTracker,
          apiClient
        );

        // Concatenate the fetched events to the total event history
        eventHistory = eventHistory.concat(fetchedEvents);
        totalEvents += fetchedEvents.length;

        // Update the calendar's sync data with the latest rangeTracker state
        calendar.syncData = rangeTracker.export();

        // Stop if the total events fetched reach the batch size
        if (totalEvents >= this.config.batchSize) {
          syncPosition.thisRef = calendarList[(calendarIndex + 1) % calendarCount].sourceId; // Continue from the next calendar in the next sync
          break;
        }
      }

      // Finalize sync position and status based on event count
      this.updateSyncPosition(
        syncPosition,
        totalEvents,
        calendarCount
      );

      // Concatenate only items after syncPosition.thisRef
      const remainingCalendars = calendarList.slice(calendarPosition + 1);

      return {
        results: remainingCalendars.concat(eventHistory),
        position: syncPosition,
      };
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }

  private getCalendarPositionIndex(
    calendarList: SchemaCalendar[],
    syncPosition: SyncHandlerPosition
  ): number {
    const calendarPosition = calendarList.findIndex(
      (calendar) => calendar.sourceId === syncPosition.thisRef
    );

    // If not found, return 0 to start from the beginning
    return calendarPosition === -1 ? 0 : calendarPosition;
  }

  private async fetchAndTrackEvents(
    calendar: SchemaCalendar,
    rangeTracker: ItemsRangeTracker,
    apiClient: calendar_v3.Calendar
  ): Promise<SchemaEvent[]> {
    // Validate calendar and calendar.id
    if (!calendar || !calendar.sourceId) {
      throw new Error('Invalid calendar or missing calendar sourceId');
    }

    // Initialize range from tracker
    let currentRange = rangeTracker.nextRange();
    let items: SchemaEvent[] = [];

    while (true) {
      // Fetch events for the current range using fetchEventRange
      const events = await this.fetchEventRange(calendar, currentRange, apiClient);

      if (!events.length) break;

      // Add fetched events to the main list
      items = items.concat(events);

      // Break loop if events reached calendar limit
      if (items.length > this.config.eventsPerCalendarLimit) {
        // Mark the current range as complete and stop
        rangeTracker.completedRange({
          startId: events[0].start.dateTime,
          endId: events[events.length - 1].end.dateTime
        }, false);
        break;
      } else {
        // Update rangeTracker and continue fetching
        rangeTracker.completedRange({
          startId: events[0].start.dateTime,
          endId: events[events.length - 1].end.dateTime
        }, false);

        // Move to the next range
        currentRange = rangeTracker.nextRange();
      }
    }

    return items;
  }

  private updateSyncPosition(
    syncPosition: SyncHandlerPosition,
    totalEvents: number,
    calendarCount: number,
  ) {
    if (totalEvents === 0) {
      syncPosition.status = SyncHandlerStatus.ENABLED;
      syncPosition.syncMessage = "No new events found.";
    } else if (totalEvents < this.config.batchSize) {
      syncPosition.syncMessage = `Processed ${totalEvents} events across ${calendarCount} calendars. Sync complete.`;
      syncPosition.status = SyncHandlerStatus.ENABLED;
    } else {
      syncPosition.status = SyncHandlerStatus.SYNCING;
      syncPosition.syncMessage = `Batch complete (${totalEvents}). More results pending.`;
    }
  }
}
