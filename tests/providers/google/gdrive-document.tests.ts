const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncHandlerPosition,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import GoogleDriveDocument from "../../../src/providers/google/gdrive-document";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaFollowing } from "../../../src/schemas";

const providerName = "google";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "gdrive-document";
let testConfig: GenericTestConfig;
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};


describe(`${providerName} GDrive Document Tests`, function () {
  this.timeout(400000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerName);
    provider = Providers(providerName, network.context, connection);
  
    testConfig = {
      idPrefix: `${provider.getProviderName()}-${connection.profile.id}`,
      timeOrderAttribute: "modifiedAt",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerName} data`, () => {
   
    it(`Can pass basic tests: ${handlerName}`, async () => {
      await CommonTests.runGenericTests(
        providerName,
        GoogleDriveDocument,
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
        providerName,
        providerId: provider.getProviderId(),
        handlerName,
        status: SyncHandlerStatus.ENABLED,
      };

      providerConfig.batchSize = 5;
      providerConfig.metadata = {
        breakTimestamp: lastRecordTimestamp,
      };

      const syncResponse = await CommonTests.runSyncTest(
        providerName,
        GoogleDriveDocument,
        connection,
        testConfig,
        syncPosition,
        providerConfig
      );
      assert.ok(
        syncResponse.results && syncResponse.results.length,
        "Have results (You may not have edited any document in the testing timeframe)"
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
        providerName,
        providerId: provider.getProviderId(),
        handlerName,
        status: SyncHandlerStatus.ENABLED,
      };

      providerConfig.batchSize = 5;
      providerConfig.metadata = {
        breakTimestamp: new Date().toISOString(),
      };

      const syncResponse = await CommonTests.runSyncTest(
        providerName,
        GoogleDriveDocument,
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
