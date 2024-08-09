const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncHandlerPosition,
  SyncSchemaPositionType,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import YoutubeFollowing from "../../../src/providers/google/youtube-following";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaFollowing } from "../../../src/schemas";

const providerName = "google";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;

describe(`${providerName} Following Tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerName);
    provider = Providers(providerName, network.context, connection);
  });

  describe(`Fetch ${providerName} data`, () => {
    const handlerName = "youtube-following";
    const testConfig: GenericTestConfig = {
      idPrefix: "youtube",
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    };
    const providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};

    it(`Can pass basic tests: ${handlerName}`, async () => {
      await CommonTests.runGenericTests(
        providerName,
        YoutubeFollowing,
        testConfig,
        providerConfig,
        connection
      );
    });

    it(`Can limit results by timestamp`, async () => {
      const lastRecordHours = 2;
      const lastRecordTimestamp = new Date(
        Date.now() - lastRecordHours * 3600000
      ).toISOString();

      const syncPosition: Omit<SyncHandlerPosition, "_id"> = {
        type: SyncSchemaPositionType.SYNC,
        providerName,
        providerId: provider.getProviderId(),
        handlerName,
        status: SyncHandlerStatus.ACTIVE,
      };

      providerConfig.batchSize = 10;
      providerConfig.metadata = {
        breakTimestamp: lastRecordTimestamp,
      };

      const syncResponse = await CommonTests.runSyncTest(
        providerName,
        YoutubeFollowing,
        connection,
        testConfig,
        syncPosition,
        providerConfig
      );
      assert.ok(
        syncResponse.results && syncResponse.results.length,
        "Have results (You may not have been subscribed in the testing timeframe)"
      );

      const results = <SchemaFollowing[]>syncResponse.results;
      assert.ok(
        results[results.length - 1].insertedAt > lastRecordTimestamp,
        "Last result is within expected date/time range"
      );
      assert.ok(
        results.length < providerConfig.batchSize,
        `Results reached the expected timestamp within the current batch size (try increasing the test batch size or reducing the break timestamp)`
      );
    });

    it(`Can handle empty results`, async () => {
      const syncPosition: Omit<SyncHandlerPosition, "_id"> = {
        type: SyncSchemaPositionType.SYNC,
        providerName,
        providerId: provider.getProviderId(),
        handlerName,
        status: SyncHandlerStatus.ACTIVE,
      };

      providerConfig.batchSize = 10;
      providerConfig.metadata = {
        breakTimestamp: new Date().toISOString(),
      };

      const syncResponse = await CommonTests.runSyncTest(
        providerName,
        YoutubeFollowing,
        connection,
        testConfig,
        syncPosition,
        providerConfig
      );
      assert.ok(
        syncResponse.results.length === 0,
        "No results should be returned for the future timestamp"
      );
    })
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
