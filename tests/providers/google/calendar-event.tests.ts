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

        assert.ok(response.position.thisRef, "Have a calendar sync pos");

        // Ensure the sync rotates the calendar list correctly
        const originalCalendarIndex = CalendarHelpers.getCalendarPositionIndex(calendars, (await provider.getSyncPosition(handlerName)).thisRef);
        const currentCalendarIndex = CalendarHelpers.getCalendarPositionIndex(calendars, response.position.thisRef);

        // Verify correct number of calendars were synced
        assert.equal(
          currentCalendarIndex,
          (originalCalendarIndex + Math.min(handlerConfig.calendarBatchSize, calendars.length)) % calendars.length,
          "Synced correct number of calendars."
        );

        // Ensure the event batch per calendar works
        const firstCalendarId = events[0].calendarId;
        const firstCalendarEvents = events.filter(event => event.calendarId === firstCalendarId);
        assert.equal(firstCalendarEvents.length, handlerConfig.eventBatchSize, "Processed correct number of events per calendar");

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

        assert.ok(secondBatchResponse.position.thisRef, "Have a calendar sync pos for second batch");

        // Ensure the sync rotates the calendar list correctly in the second batch
        const secondOriginalCalendarIndex = CalendarHelpers.getCalendarPositionIndex(secondBatchCalendars, (await provider.getSyncPosition(handlerName)).thisRef);
        const secondCurrentCalendarIndex = CalendarHelpers.getCalendarPositionIndex(secondBatchCalendars, secondBatchResponse.position.thisRef);

        // Verify correct number of calendars were synced in the second batch
        assert.equal(
          secondCurrentCalendarIndex,
          (secondOriginalCalendarIndex + Math.min(handlerConfig.calendarBatchSize, secondBatchCalendars.length)) % secondBatchCalendars.length,
          "Synced correct number of calendars in the second batch."
        );

        // Check if synced every calendar correctly
        const syncedCalendar = (secondBatchCalendars.filter(cal => cal.sourceId === secondBatchEvents[0].calendarId))[0];
        assert.ok(syncedCalendar.syncData, "Have a sync range per calendar.")

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
