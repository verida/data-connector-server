const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncSchemaPosition,
  SyncSchemaPositionType,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import DataPortability from "../../../src/providers/google-portability/dataportability";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";

const providerName = "google";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;

describe(`${providerName} Tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerName);
    provider = Providers(providerName, network.context, connection);
  });

  describe(`Fetch ${providerName} data`, () => {
    const handlerName = "google-portability";
    const testConfig: GenericTestConfig = {
      idPrefix: "google-portability",
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    };
    const providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};

    // it(`Can pass basic tests: ${handlerName}`, async () => {
    //   await CommonTests.runGenericTests(
    //     providerName,
    //     Gmail,
    //     testConfig,
    //     providerConfig
    //   );
    // });

    it(`Can get data`, async () => {
      const syncPosition: Omit<SyncSchemaPosition, "_id" | "schemaUri"> = {
        type: SyncSchemaPositionType.SYNC,
        provider: providerName,
        status: SyncHandlerStatus.ACTIVE,
      };

      providerConfig.batchSize = 10;

      const syncResponse = await CommonTests.runSyncTest(
        providerName,
        DataPortability,
        testConfig,
        syncPosition,
        providerConfig
      );

      console.log(syncResponse)
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
