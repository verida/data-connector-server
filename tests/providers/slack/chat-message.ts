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

import SlackChatMessageHandler from "../../../src/providers/slack/chat-message";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaSocialChatGroup, SchemaSocialChatMessage, SchemaRecord } from "../../../src/schemas";
import { SlackHandlerConfig } from "../../../src/providers/slack/interfaces";
import { SlackHelpers } from "../../../src/providers/slack/helpers";

// Define the provider ID
const providerId = "slack";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "chat-message";
let testConfig: GenericTestConfig;

// Configure provider and handler without certain attributes
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {};
let handlerConfig: SlackHandlerConfig = {
  messagesPerGroupLimit: 3
};

// Test suite for Slack Chat Message syncing
describe(`${providerId} chat message tests`, function () {
  this.timeout(100000);

  // Before all tests, set up the network, connection, and provider
  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerId);
    provider = Providers(providerId, network.context, connection);

    // Configure test settings
    testConfig = {
      idPrefix: `${provider.getProviderId()}-${connection.profile.id}`,
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  // Test fetching data for Slack Chat
  describe(`Fetch ${providerId} data`, () => {

    it(`Can pass basic tests: ${handlerName}`, async () => {
      // Build the necessary test objects
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SlackChatMessageHandler,
        providerConfig,
        connection
      );

      // Set the handler configuration
      handler.setConfig(handlerConfig);

      try {
        // Set up initial sync position
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${handlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        // Start the sync process
        const response = await handler._sync(api, syncPosition);
        const results = <SchemaRecord[]>response.results;

        // Extract chat groups and messages from the results
        const chatGroups = <SchemaSocialChatGroup[]>results.filter(result => result.schema === CONFIG.verida.schemas.CHAT_GROUP);
        const chatMessages = <SchemaSocialChatMessage[]>results.filter(result => result.schema === CONFIG.verida.schemas.CHAT_MESSAGE);

        // Ensure results are returned
        assert.ok(results && results.length, "Have results returned");

        // Check IDs in the returned items
        CommonTests.checkItem(results[0], handler, provider);

        // Verify sync status is active
        assert.equal(
          SyncHandlerStatus.SYNCING,
          response.position.status,
          "Sync is active"
        );

        // Ensure the message batch per group works
        const firstGroupId = chatMessages[0].groupId;
        const firstGroupMessages = chatMessages.filter(msg => msg.groupId === firstGroupId);
        assert.equal(firstGroupMessages.length, handlerConfig.messagesPerGroupLimit, "Processed correct number of messages per group");

         /**
          * Start the second sync batch process
          */
        const secondBatchResponse = await handler._sync(api, response.position);
        const secondBatchResults = <SchemaRecord[]>secondBatchResponse.results;

        // Extract chat groups and messages from the second batch results
        const secondBatchChatGroups = <SchemaSocialChatGroup[]>secondBatchResults.filter(result => result.schema === CONFIG.verida.schemas.CHAT_GROUP);
        const secondBatchChatMessages = <SchemaSocialChatMessage[]>secondBatchResults.filter(result => result.schema === CONFIG.verida.schemas.CHAT_MESSAGE);

        // Ensure second batch results are returned
        assert.ok(secondBatchResults && secondBatchResults.length, "Have second batch results returned");

        // Check IDs in the returned items for the second batch
        CommonTests.checkItem(secondBatchResults[0], handler, provider);

        // Verify sync status is still active for the second batch
        assert.equal(
          SyncHandlerStatus.SYNCING,
          secondBatchResponse.position.status,
          "Sync is still active after second batch"
        );

        // Check if synced every chat group correctly
        const syncedGroup = (secondBatchChatGroups.filter(group => group.sourceId === secondBatchChatMessages[0].groupId))[0];
        assert.ok(syncedGroup.syncData, "Have a sync range per chat group.");

      } catch (err) {
        // Ensure provider closes even if an error occurs
        await provider.close();
        throw err;
      }
    });
  });

  // After all tests, close the network context
  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
