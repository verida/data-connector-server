const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncHandlerPosition,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import Gmail from "../../../src/providers/google/gmail";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaEmail } from "../../../src/schemas";

const providerName = "google";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "gmail";
let testConfig: GenericTestConfig;
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};

console.log(`WARNING: Sometimes these tests fail because the Google API doesnt return inbox messages in the correct time order. This is a bug in the Google API and there's not much we can do about it.`)

describe(`${providerName} Tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerName);
    provider = Providers(providerName, network.context, connection);
    
    testConfig = {
      idPrefix: `${provider.getProviderName()}-${connection.profile.id}`,
      timeOrderAttribute: "sentAt",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerName} data`, () => {

    it(`Can pass basic tests: ${handlerName}`, async () => {
      /**
       * Things to test:
       * 
       * - New items are processed
       * - Backfill items are processed
       * - Not enough new items? Process backfill
       * - Backfill twice doesn't process the same items
       * - No more backfill produces empty rangeTracker
       */

      await CommonTests.runGenericTests(
        providerName,
        Gmail,
        testConfig,
        providerConfig,
        connection
      );
    });

    it(`Can limit results by timestamp`, async () => {
      const lastRecordHours = 1;
      const lastRecordTimestamp = new Date(
        Date.now() - lastRecordHours * 3600000
      ).toISOString();

      const syncPosition: Omit<SyncHandlerPosition, "_id"> = {
        providerName,
        providerId: provider.getProviderId(),
        handlerName,
        status: SyncHandlerStatus.ENABLED,
      };

      providerConfig.batchSize = 20;
      providerConfig.metadata = {
        breakTimestamp: lastRecordTimestamp,
      }

      const syncResponse = await CommonTests.runSyncTest(
        providerName,
        Gmail,
        connection,
        testConfig,
        syncPosition,
        providerConfig
      );
      assert.ok(
        syncResponse.results && syncResponse.results.length,
        "Have results (Emails may not have been received in the testing timeframe)"
      );

      const results = <SchemaEmail[]>syncResponse.results;
      assert.ok(
        results[results.length - 1].sentAt > lastRecordTimestamp,
        "Last result is within expected date/time range"
      );

      assert.ok(
        results.length < providerConfig.batchSize,
        `Results reached the expected timestamp within the current batch size (try increasing the test batch size or reducing the break timetamp)`
      );
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
