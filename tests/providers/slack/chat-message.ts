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
import { SlackHandlerConfig, SlackChatGroupType } from "../../../src/providers/slack/interfaces";
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
  messagesPerGroupLimit: 3,
  channelTypes: [
    SlackChatGroupType.IM.toString(), // DM first
    SlackChatGroupType.PRIVATE_CHANNEL.toString(),
    SlackChatGroupType.PUBLIC_CHANNEL.toString(),
  ].join(','),
  maxBatchSize: 50
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

        // Check if every chat group with messages is synced correctly
        const groupIdsWithMessages = new Set(secondBatchChatMessages.map((msg) => msg.groupId));

        groupIdsWithMessages.forEach((groupId) => {
          const syncedGroup = secondBatchChatGroups.find((group) => group.sourceId === groupId);
          assert.ok(syncedGroup, `Chat group with sourceId ${groupId} exists in the batch`);
          assert.ok(syncedGroup!.syncData, `Chat group with sourceId ${groupId} has a valid sync range`);
        });


      } catch (err) {
        // Ensure provider closes even if an error occurs
        await provider.close();
        throw err;
      }
    });

    it(`Should match email from User Info with message's fromHandle`, async () => {
      try {
        // Build the necessary test objects
        const { api, handler, provider } = await CommonTests.buildTestObjects(
          providerId,
          SlackChatMessageHandler,
          providerConfig,
          connection
        );

        // Set the handler configuration
        handler.setConfig(handlerConfig);

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
        const secondBatchResults = <SchemaRecord[]>response.results;

        // Extract chat messages from the second batch results
        const chatMessages = <SchemaSocialChatMessage[]>(
          secondBatchResults.filter(
            (result) => result.schema === CONFIG.verida.schemas.CHAT_MESSAGE
          )
        );

        // Check email comparison for the first message
        const firstMessage = chatMessages[0];
        const userInfo = await SlackHelpers.getUserInfo(
          connection.accessToken,
          firstMessage.fromId
        );

        // Compare email from fromHandle and userInfo
        assert.equal(
          firstMessage.fromHandle,
          userInfo.profile.email,
          "fromHandle email matches userInfo email"
        );

      } catch (err) {
        await provider.close();
        throw err;
      }
    });

    it(`Should process most recent messages first`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SlackChatMessageHandler,
        providerConfig,
        connection
      );
      handler.setConfig(handlerConfig);

      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      const response = await handler._sync(api, syncPosition);
      const results = (<SchemaSocialChatMessage[]>response.results).filter(
        (result) => result.schema === CONFIG.verida.schemas.CHAT_MESSAGE
      );

      const timestamps = results.map((msg) => new Date(msg.insertedAt!).getTime());
      const isSortedDescending = timestamps.every(
        (val, i, arr) => i === 0 || arr[i - 1] >= val
      );

      assert.ok(isSortedDescending, "Messages are processed from most recent to oldest");
    });

    it(`Should ensure second batch items aren't in the first batch`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SlackChatMessageHandler,
        providerConfig,
        connection
      );
      handler.setConfig(handlerConfig);

      const firstBatchResponse = await handler._sync(api, {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      });

      const firstBatchMessages = (<SchemaSocialChatMessage[]>firstBatchResponse.results).filter(
        (result) => result.schema === CONFIG.verida.schemas.CHAT_MESSAGE
      );

      setTimeout(() => {
        console.log("Wait for saving sync data");
      }, 3000);
      const secondBatchResponse = await handler._sync(api, firstBatchResponse.position);
      const secondBatchMessages = (<SchemaSocialChatMessage[]>secondBatchResponse.results).filter(
        (result) => result.schema === CONFIG.verida.schemas.CHAT_MESSAGE
      );

      const firstBatchIds = firstBatchMessages.map((msg) => msg.sourceId);
      const secondBatchIds = secondBatchMessages.map((msg) => msg.sourceId);

      const intersection = firstBatchIds.filter((id) => secondBatchIds.includes(id));
      assert.equal(intersection.length, 0, "No overlapping messages between batches");
    });

    it(`Should process each type of chat group correctly`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        SlackChatMessageHandler,
        providerConfig,
        connection
      );
      handler.setConfig(handlerConfig);

      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      const response = await handler._sync(api, syncPosition);
      const results = (<SchemaSocialChatMessage[]>response.results).filter(
        (result) => result.schema === CONFIG.verida.schemas.CHAT_MESSAGE
      );

      // Check if each type of group has at least one message
      const groupTypes = {
        [SlackChatGroupType.IM]: false,
        [SlackChatGroupType.PRIVATE_CHANNEL]: true,
        [SlackChatGroupType.PUBLIC_CHANNEL]: true,
      };

      results.forEach((message) => {
        const group = (<SchemaSocialChatGroup[]>response.results).find(
          (result) =>
            result.schema === CONFIG.verida.schemas.CHAT_GROUP &&
            result.sourceId === message.groupId
        );

        if (group) {
          if (group.sourceData!.hasOwnProperty('is_im') && (group.sourceData! as any).is_im) {
            groupTypes[SlackChatGroupType.IM] = true;
          }

          if (group.sourceData!.hasOwnProperty('is_private') && (group.sourceData! as any).is_private) {
            groupTypes[SlackChatGroupType.PRIVATE_CHANNEL] = true;
          }

          if (group.sourceData!.hasOwnProperty('is_channel') && (group.sourceData! as any).is_channel) {
            groupTypes[SlackChatGroupType.PUBLIC_CHANNEL] = true;
          }
        }
      });

      // Assert that all group types are represented
      Object.entries(groupTypes).forEach(([type, isPresent]) => {
        assert.ok(
          isPresent,
          `Chat group type ${type} should have messages processed`
        );
      });
    });


  });

  // After all tests, close the network context
  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
