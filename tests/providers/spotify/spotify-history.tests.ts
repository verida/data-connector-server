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

import SpotifyPlayHistory from "../../../src/providers/spotify/spotify-history";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaHistory } from "../../../src/schemas";
import { SpotifyHandlerConfig } from "../../../src/providers/spotify/interfaces";

const providerId = "spotify";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "spotify-history";
let testConfig: GenericTestConfig;

let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};
let handlerConfig: SpotifyHandlerConfig = {
  batchSize: 20,
  maxBatchSize: 50
};

describe(`${providerId} play history tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerId);
    provider = Providers(providerId, network.context, connection);
    
    testConfig = {
      idPrefix: `${provider.getProviderId()}-${connection.profile.id}`,
      timeOrderAttribute: "timestamp",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerId} data`, () => {
    it(`Can pass basic tests: ${handlerName}`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyPlayHistory,
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

        const response = await handler._sync(api, syncPosition);
        const results = <SchemaHistory[]>response.results;

        assert.ok(results && results.length, "Have results returned");
        assert.ok(results.length <= handlerConfig.batchSize, "Results respect batch size limit");

        CommonTests.checkItem(results[0], handler, provider);

        assert.equal(
          SyncHandlerStatus.SYNCING,
          response.position.status,
          "Sync is active"
        );

        // Test second batch
        const secondBatchResponse = await handler._sync(api, response.position);
        const secondBatchResults = <SchemaHistory[]>secondBatchResponse.results;

        assert.ok(secondBatchResults && secondBatchResults.length, "Have second batch results");
        assert.ok(secondBatchResults.length <= handlerConfig.batchSize, "Second batch respects size limit");

      } catch (err) {
        await provider.close();
        throw err;
      }
    });

    it(`Should process most recent plays first`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyPlayHistory,
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
      const results = <SchemaHistory[]>response.results;

      const timestamps = results.map((item) => new Date(item.timestamp).getTime());
      const isSortedDescending = timestamps.every(
        (val, i, arr) => i === 0 || arr[i - 1] >= val
      );

      assert.ok(isSortedDescending, "Play history is processed from most recent to oldest");
    });

    it(`Should ensure second batch items aren't in the first batch`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SpotifyPlayHistory,
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

      const firstBatchItems = <SchemaHistory[]>firstBatchResponse.results;

      const secondBatchResponse = await handler._sync(api, firstBatchResponse.position);
      const secondBatchItems = <SchemaHistory[]>secondBatchResponse.results;

      const firstBatchIds = firstBatchItems.map((item) => item.sourceId);
      const secondBatchIds = secondBatchItems.map((item) => item.sourceId);

      const intersection = firstBatchIds.filter((id) => secondBatchIds.includes(id));
      assert.equal(intersection.length, 0, "No overlapping items between batches");
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
}); 