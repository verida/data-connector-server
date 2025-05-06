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

import SpotifyFollowing from "../../../src/providers/spotify/spotify-following";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaFollowing } from "../../../src/schemas";
import { SpotifyHandlerConfig } from "../../../src/providers/spotify/interfaces";

const providerId = "spotify";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "spotify-following";
let testConfig: GenericTestConfig;

let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};
let handlerConfig: SpotifyHandlerConfig = {
  batchSize: 20,
  maxBatchSize: 50
};

describe(`${providerId} following tests`, function () {
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
        SpotifyFollowing,
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
        const results = <SchemaFollowing[]>response.results;

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
        const secondBatchResults = <SchemaFollowing[]>secondBatchResponse.results;

        // Verify second batch
        assert.ok(secondBatchResults && secondBatchResults.length, "Have second batch results");
        assert.ok(secondBatchResults.length <= handlerConfig.batchSize, "Second batch respects size limit");

        // Check for unique items between batches
        const firstBatchIds = results.map(item => item.sourceId);
        const secondBatchIds = secondBatchResults.map(item => item.sourceId);
        const intersection = firstBatchIds.filter(id => secondBatchIds.includes(id));
        assert.equal(intersection.length, 0, "No overlapping items between batches");

      } catch (err) {
        await provider.close();
        throw err;
      }
    });

    it(`Should have valid following data structure`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyFollowing,
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
      const results = <SchemaFollowing[]>response.results;

      // Test first result has required fields
      const firstResult = results[0];
      assert.ok(firstResult.name, "Has name");
      assert.ok(firstResult.sourceId, "Has sourceId");
      assert.ok(firstResult.sourceData, "Has sourceData");
      assert.ok(firstResult.insertedAt, "Has insertedAt timestamp");
    });


    it(`Should handle pagination correctly`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyFollowing,
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
      const firstResults = <SchemaFollowing[]>firstResponse.results;

      // Get second batch
      const secondResponse = await handler._sync(api, firstResponse.position);
      const secondResults = <SchemaFollowing[]>secondResponse.results;

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