const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncHandlerPosition,
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
let handlerName = "youtube-following";
let testConfig: GenericTestConfig;
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};


describe(`${providerName} Youtube Following Tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerName);
    provider = Providers(providerName, network.context, connection);
  
    testConfig = {
      idPrefix: `${provider.getProviderName()}-${connection.profile.id}`,
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerName} data`, () => {
   
    it(`Can pass basic tests: ${handlerName}`, async () => {
      await CommonTests.runGenericTests(
        providerName,
        YoutubeFollowing,
        testConfig,
        providerConfig,
        connection
      );
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
