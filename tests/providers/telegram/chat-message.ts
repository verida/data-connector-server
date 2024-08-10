const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import TelegramChatMessageHandler from "../../../src/providers/telegram/chat-message";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";

const providerName = "telegram";
// let network: NetworkInstance;
// let connection: Connection;
// let provider: BaseProvider;

describe(`${providerName} chat tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    // network = await CommonUtils.getNetwork();
    // connection = await CommonUtils.getConnection(providerName);
    // provider = Providers(providerName, network.context, connection);
  });

  describe(`Fetch ${providerName} data`, () => {
    const handlerName = "gmail";
    const testConfig: GenericTestConfig = {
      idPrefix: "gmail",
      timeOrderAttribute: "sentAt",
      batchSizeLimitAttribute: "batchSize",
    };
    const providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};

    it(`Can pass basic tests: ${handlerName}`, async () => {
      const { provider } = await CommonTests.runGenericTests(
        providerName,
        TelegramChatMessageHandler,
        testConfig,
        providerConfig
      );
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
