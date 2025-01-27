const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncHandlerPosition,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import YouTubeFavourite from "../../../src/providers/google/youtube-favourite";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaFavourite } from "../../../src/schemas";

const providerId = "google";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "youtube-favourite";
let testConfig: GenericTestConfig;
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};

describe(`${providerId} Youtube Favourite Tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerId);
    provider = Providers(providerId, network.context, connection);
  
    testConfig = {
      idPrefix: `${provider.getProviderId()}-${connection.profile.id}`,
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerId} data`, () => {
    
    it(`Can pass basic tests: ${handlerName}`, async () => {
      await CommonTests.runGenericTests(
        providerId,
        YouTubeFavourite,
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
