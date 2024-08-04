const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncFrequency,
  SyncStatus,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import MockPost from "../../../src/providers/mock/post";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import {  } from "../../../src/schemas";

const providerName = "mock";
const handlerName = "post";
let network: NetworkInstance;
let provider: BaseProvider;

// Create a fake connection
const connection: Connection = {
  name: 'mock:1',
  provider: 'mock',
  providerId: '',
  accessToken: '',
  profile: {
    id: '1',
    name: 'Mock profile'
  },
  syncStatus: SyncStatus.ACTIVE,
  syncFrequency: SyncFrequency.DAY,
  handlers: [],
  config: {}
}

describe(`${providerName} Tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    provider = Providers(providerName, network.context, connection);
  });

  describe(`Fetch ${providerName} data`, () => {
    const testConfig: GenericTestConfig = {
      idPrefix: handlerName,
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "limit",
    };
    const providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};

    it(`Can pass basic tests: ${handlerName}`, async () => {
      await CommonTests.runGenericTests(
        providerName,
        MockPost,
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
