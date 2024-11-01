const assert = require("assert");
import CONFIG from "../../../src/config";
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import CalendarEventHandler from "../../../src/providers/google/calendar-event";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaCalendar, SchemaEvent, SchemaRecord } from "../../../src/schemas";
import { GoogleCalendarHandlerConfig } from "../../../src/providers/google/interfaces";
import { CalendarHelpers } from "../../../src/providers/google/helpers";

// Define the provider ID
const providerId = "google";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "calendar-event";
let testConfig: GenericTestConfig;

// Configure provider and handler without certain attributes
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};
let handlerConfig: GoogleCalendarHandlerConfig = {
  calendarBatchSize: 3,
  eventBatchSize: 3
};

const TEST_EVENT = {
  kind: 'calendar#event',
  etag: '"3016564997954000"',
  id: '1k89v9aphj7rg71_20171016',
  status: 'confirmed',
  htmlLink: 'https://www.google.com/calendar/event?eid=MWs4OXY5YXBoajdyZzcxdjBkZ2gzZmVnMjJfMj',
  created: '2017-10-08T03:08:56.000Z',
  updated: '2017-10-17T23:21:38.977Z',
  summary: 'TEST EVENT',
  creator: { email: 'ME@gmail.com', displayName: 'ME' },
  organizer: {
    email: 'op88nn863ft55@group.calendar.google.com',
    displayName: 'ME CALENDAR',
    self: true
  },
  start: { date: '2017-10-16' },
  end: { date: '2017-10-17' },
  recurringEventId: 'rg71v0d',
  originalStartTime: { date: '2017-10-16' },
  transparency: 'transparent',
  iCalUID: '7rg71v0dgh3feg22@google.com',
  sequence: 0,
  reminders: { useDefault: false },
  eventType: 'default'
}

// Test suite for Google Calendar event syncing
describe(`${providerId} calendar event tests`, function () {
  this.timeout(100000);

  // Before all tests, set up the network, connection, and provider
  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerId);
    provider = Providers(providerId, network.context, connection);

    // Configure test settings
    testConfig = {
      idPrefix: `${provider.getProviderId()}-${connection.profile.id}`,
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  // Test fetching data for Google Calendar
  describe(`Fetch ${providerId} data`, () => {

    it(`Can handle date only events`, async () => {
      // Build the necessary test objects
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        CalendarEventHandler,
        providerConfig,
        connection
      );

      const testEventResult = (<CalendarEventHandler> handler).buildResult(TEST_EVENT.iCalUID, TEST_EVENT);

      const expectedStartDate = `${TEST_EVENT.start.date}T00:00:00.000Z`;
      const expectedEndDate = `${TEST_EVENT.end.date}T00:00:00.000Z`;
      
      assert.equal(expectedStartDate, testEventResult.start.dateTime, 'Start date is expected date');
      assert.equal(expectedEndDate, testEventResult.end.dateTime, 'End date is expected date');

      const startDate = new Date(testEventResult.start.dateTime);
      const endDate = new Date(testEventResult.end.dateTime);

      assert.equal(startDate.toISOString(), (new Date(TEST_EVENT.start.date)).toISOString(), 'Start date is a valid ISO string');
      assert.equal(endDate.toISOString(), (new Date(TEST_EVENT.end.date)).toISOString(), 'End date is a valid ISO string');
    });

    it(`Can pass basic tests: ${handlerName}`, async () => {
      // Build the necessary test objects
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        CalendarEventHandler,
        providerConfig,
        connection
      );

      // Set the handler configuration
      handler.setConfig(handlerConfig);

      try {
        // Set up initial sync position
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${handlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        // Start the sync process
        const response = await handler._sync(api, syncPosition);
        const results = <SchemaRecord[]>response.results;

        // Extract calendars and events from the results
        const calendars = <SchemaCalendar[]>results.filter(result => result.schema === CONFIG.verida.schemas.CALENDAR);
        const events = <SchemaEvent[]>results.filter(result => result.schema === CONFIG.verida.schemas.EVENT);

        // Ensure results are returned
        assert.ok(results && results.length, "Have results returned");

        // Check IDs in the returned items
        CommonTests.checkItem(results[0], handler, provider);

        // Verify sync status is active
        assert.equal(
          SyncHandlerStatus.SYNCING,
          response.position.status,
          "Sync is active"
        );

        // Ensure the event batch per calendar works
        const firstCalendarId = events[0].calendarId;
        const firstCalendarEvents = events.filter(event => event.calendarId === firstCalendarId);
        assert.equal(firstCalendarEvents.length, handlerConfig.eventBatchSize, "Processed correct number of events per calendar");

        //Verify only user-owned calendars are fetched         
        calendars.forEach((calendar: SchemaCalendar) => {
          assert.ok(
            (calendar.sourceData as { organizer?: { self: boolean } }).organizer?.self,
            "Calendar is owned by the user (self: true)"
          );
        });

        /**
         * Verify recurring events are within one month
         */
        const now = new Date();
        const oneMonthLater = new Date(now);
        oneMonthLater.setMonth(now.getMonth() + 1);

        events.forEach((event) => {
          if (event.sourceData && 'recurrence' in event.sourceData) {
            const startDateTime = new Date(event.start.dateTime);
            assert.ok(
              startDateTime <= oneMonthLater,
              "Recurring event is within one month from now"
            );
          }
        });

        /**
         * Start the second sync batch process
         */
        const secondBatchResponse = await handler._sync(api, response.position);
        const secondBatchResults = <SchemaRecord[]>secondBatchResponse.results;

        // Extract calendars and events from the second batch results
        const secondBatchCalendars = <SchemaCalendar[]>secondBatchResults.filter(result => result.schema === CONFIG.verida.schemas.CALENDAR);
        const secondBatchEvents = <SchemaEvent[]>secondBatchResults.filter(result => result.schema === CONFIG.verida.schemas.EVENT);

        // Ensure second batch results are returned
        assert.ok(secondBatchResults && secondBatchResults.length, "Have second batch results returned");

        // Check IDs in the returned items for the second batch
        CommonTests.checkItem(secondBatchResults[0], handler, provider);

        // Verify sync status is still active for the second batch
        assert.equal(
          SyncHandlerStatus.SYNCING,
          secondBatchResponse.position.status,
          "Sync is still active after second batch"
        );

        // Check if synced every calendar correctly
        const syncedCalendar = (secondBatchCalendars.filter(cal => cal.sourceId === secondBatchEvents[0].calendarId))[0];
        assert.ok(syncedCalendar.syncData, "Have a sync range per calendar.");

      } catch (err) {
        // Ensure provider closes even if an error occurs
        await provider.close();
        throw err;
      }
    });
  });

  // After all tests, close the network context
  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
