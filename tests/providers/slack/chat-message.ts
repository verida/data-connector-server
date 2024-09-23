const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncHandlerPosition,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import SlackChatMessageHandler from "../../../src/providers/slack/chat-message";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaSocialChatMessage } from "../../../src/schemas";

const providerName = "slack";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "slack-messages";
let testConfig: GenericTestConfig;
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};

describe(`${providerName} Slack Chat Message Handler Tests`, function () {
  this.timeout(100000); // Increase timeout due to API rate limits and potential delays

  this.beforeAll(async function () {
    // Set up the Slack network, connection, and provider
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerName);
    provider = Providers(providerName, network.context, connection);

    // Define test configuration
    testConfig = {
      idPrefix: `${provider.getProviderName()}-${connection.profile.id}`,
      batchSizeLimitAttribute: "messageBatchSize", // Adjust to match Slack-specific batch size config
    };
  });

  describe(`Fetch ${providerName} data`, () => {
   
    it(`Can pass basic tests: ${handlerName}`, async () => {
      // Run the generic common tests for Slack Chat Message Handler
      await CommonTests.runGenericTests(
        providerName,
        SlackChatMessageHandler,
        testConfig,
        providerConfig,
        connection
      );
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close(); // Clean up after tests
  });
});
