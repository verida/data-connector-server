const assert = require("assert");
import CONFIG from "../../../src/config";
import {
  BaseHandlerConfig,
  BaseProviderConfig,
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import FirefliesMeetingTranscriptHandler from "../../../src/providers/fireflies/meeting-transcript";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaMeetingTranscript, SchemaRecord } from "../../../src/schemas";

const providerId = "fireflies";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "meeting-transcript";
let testConfig: GenericTestConfig;

let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};
let handlerConfig: BaseHandlerConfig = {
  batchSize: 20
};

describe(`${providerId} meeting transcript tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerId);
    provider = Providers(providerId, network.context, connection);

    testConfig = {
      idPrefix: `${provider.getProviderId()}-${connection.profile.id}`,
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerId} data`, () => {
    it(`Can pass basic tests: ${handlerName}`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        FirefliesMeetingTranscriptHandler,
        providerConfig,
        connection
      );

      handler.setConfig(handlerConfig);

      try {
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${handlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        // First batch
        const response = await handler._sync(api, syncPosition);
        const results = <SchemaMeetingTranscript[]>response.results;

        // Basic assertions
        assert.ok(results && results.length, "Have results returned");        
        assert.ok(results.length > 0, "Have meeting-transcripts returned");

        // Check first item structure
        CommonTests.checkItem(results[0], handler, provider);

        // Verify sync status
        assert.equal(
          SyncHandlerStatus.SYNCING,
          response.position.status,
          "Sync is active"
        );

        // Second batch
        const secondBatchResponse = await handler._sync(api, response.position);
        const secondBatchResults = <SchemaMeetingTranscript[]>secondBatchResponse.results;

        // Verify second batch
        assert.ok(secondBatchResults && secondBatchResults.length, "Have second batch results");
      } catch (err) {
        await provider.close();
        throw err;
      }
    });

    it(`Should have valid meeting-transcript data structure`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        FirefliesMeetingTranscriptHandler,
        providerConfig,
        connection
      );
      handler.setConfig(handlerConfig);

      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      const response = await handler._sync(api, syncPosition);
      const results = <SchemaMeetingTranscript[]>response.results;

      // Check meeting-transcript structure
      const firstItem = results[0];      
      assert.ok(firstItem.organizerEmail, "Item has organizer");      
      assert.ok(firstItem.duration, "Item has duration");      
      assert.ok(firstItem.sourceId, "Item has sourceId");      
      assert.ok(firstItem.summary, "Item has summary");
    });

    it(`Should process meeting-transcripts in chronological order`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        FirefliesMeetingTranscriptHandler,
        providerConfig,
        connection
      );
      handler.setConfig(handlerConfig);

      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      const response = await handler._sync(api, syncPosition);
      const results = <SchemaMeetingTranscript[]>response.results;

      const timestamps = results.map(t => new Date(t.dateTime!).getTime());
      const isSortedAscending = timestamps.every(
        (val, i, arr) => i === 0 || val >= arr[i - 1]
      );

      assert.ok(isSortedAscending, "Meeting-transcripts are processed in chronological order");
    });

    it(`Should ensure second batch items aren't in the first batch`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        FirefliesMeetingTranscriptHandler,
        providerConfig,
        connection
      );
      handler.setConfig(handlerConfig);

      const firstBatchResponse = await handler._sync(api, {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      });

      const firstBatchItems = <SchemaMeetingTranscript[]>firstBatchResponse.results;

      const secondBatchResponse = await handler._sync(api, firstBatchResponse.position);
      const secondBatchItems = <SchemaMeetingTranscript[]>secondBatchResponse.results;

      const firstBatchIds = firstBatchItems.map(item => item.sourceId);
      const secondBatchIds = secondBatchItems.map(item => item.sourceId);

      const intersection = firstBatchIds.filter(id => secondBatchIds.includes(id));
      assert.equal(intersection.length, 0, "No overlapping items between batches");
    });

    it(`Should handle AI-generated metadata correctly`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        FirefliesMeetingTranscriptHandler,
        providerConfig,
        connection
      );
      handler.setConfig(handlerConfig);

      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      const response = await handler._sync(api, syncPosition);
      const results = <SchemaMeetingTranscript[]>response.results;

      results.forEach(item => {
        // Check AI-generated metadata(summary, topics, score etc), summary only
        assert.ok(item.summary, "Item has AI summary");
       
        // Check meeting metadata(start, end time, participants etc), duration only
        assert.ok(typeof item.duration === 'number', "Item has valid duration");
      });
    });

  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
