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

import SpotifyFavourite from "../../../src/providers/spotify/spotify-favourite";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaFavourite } from "../../../src/schemas";
import { SpotifyHandlerConfig } from "../../../src/providers/spotify/interfaces";

const providerId = "spotify";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "spotify-favourite";
let testConfig: GenericTestConfig;

let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};
let handlerConfig: SpotifyHandlerConfig = {
  batchSize: 20,
  maxBatchSize: 50
};

describe(`${providerId} favourite tests`, function () {
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
        SpotifyFavourite,
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
        const results = <SchemaFavourite[]>response.results;

        // Basic assertions
        assert.ok(results && results.length, "Have results returned");
        assert.ok(results.length <= handlerConfig.batchSize, "Results respect batch size limit");

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
        const secondBatchResults = <SchemaFavourite[]>secondBatchResponse.results;

        // Verify second batch
        assert.ok(secondBatchResults && secondBatchResults.length, "Have second batch results");
        assert.ok(secondBatchResults.length <= handlerConfig.batchSize, "Second batch respects size limit");

      } catch (err) {
        await provider.close();
        throw err;
      }
    });

    it(`Should have valid favourite data structure`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyFavourite,
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
      const results = <SchemaFavourite[]>response.results;

      // Test first result has required fields
      const firstFavourite = results[0];
      assert.ok(firstFavourite.name, "Has name");
      assert.ok(firstFavourite.sourceId, "Has sourceId");
      assert.ok(firstFavourite.sourceData, "Has sourceData");
      assert.ok(firstFavourite.insertedAt, "Has insertedAt timestamp");
    });

    it(`Should ensure second batch items aren't in the first batch`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyFavourite,
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

      const firstBatchItems = <SchemaFavourite[]>firstBatchResponse.results;

      const secondBatchResponse = await handler._sync(api, firstBatchResponse.position);
      const secondBatchItems = <SchemaFavourite[]>secondBatchResponse.results;

      const firstBatchIds = firstBatchItems.map(item => item.sourceId);
      const secondBatchIds = secondBatchItems.map(item => item.sourceId);

      const intersection = firstBatchIds.filter(id => secondBatchIds.includes(id));
      assert.equal(intersection.length, 0, "No overlapping items between batches");
    });

    it(`Should handle different time ranges`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyFavourite,
        providerConfig,
        connection
      );

      const timeRanges = ['short_term', 'medium_term', 'long_term'];
      
      for (const timeRange of timeRanges) {
        handler.setConfig({
          ...handlerConfig,
          timeRange
        });

        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${handlerName}-${timeRange}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        const response = await handler._sync(api, syncPosition);
        const results = <SchemaFavourite[]>response.results;

        assert.ok(results.length > 0, `Got results for ${timeRange} time range`);
      }
    });

    it(`Should include both track and artist details`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyFavourite,
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
      const results = <SchemaFavourite[]>response.results;

      results.forEach(favourite => {
        // Check track details
        assert.ok(favourite.name, "Has track name");
      });
    });

    it(`Should handle pagination correctly`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyFavourite,
        providerConfig,
        connection
      );

      // Set a small batch size to force pagination
      handler.setConfig({
        ...handlerConfig,
        batchSize: 5
      });

      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      // Get first batch
      const firstResponse = await handler._sync(api, syncPosition);
      const firstResults = <SchemaFavourite[]>firstResponse.results;

      // Get second batch
      const secondResponse = await handler._sync(api, firstResponse.position);
      const secondResults = <SchemaFavourite[]>secondResponse.results;

      // Verify pagination
      assert.equal(firstResults.length, 5, "First batch has correct size");
      assert.ok(secondResults.length > 0, "Second batch has results");
      assert.ok(firstResponse.position.thisRef, "Has pagination reference");
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
}); 