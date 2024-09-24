const assert = require("assert");
import {
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import TelegramChatMessageHandler from "../../../src/providers/telegram/chat-message";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { TelegramConfig } from "../../../src/providers/telegram/interfaces";
import { SchemaSocialChatGroup, SchemaSocialChatMessage } from "../../../src/schemas";

const providerId = "telegram";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "chat-message";
let testConfig: GenericTestConfig;
let providerConfig: Omit<TelegramConfig, "sbtImage" | "label" | "apiId" | "apiHash"> = {
  maxSyncLoops: 1,
  groupLimit: 2,
  messageMaxAgeDays: 7,
  messageBatchSize: 20,
  messagesPerGroupLimit: 10,
  maxGroupSize: 100,
  useDbPos: false
};

// Tests:
// - group limit respected (y)
// - max age days respected
// - message batch size respected (y)
// - messages per group limit respected (y)

describe(`${providerId} chat tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerId);
    provider = Providers(providerId, network.context, connection);
    
    testConfig = {
      idPrefix: `${provider.getProviderId()}-${connection.profile.id}`,
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerId} data`, () => {

    it(`Can pass basic tests: ${handlerName}`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        TelegramChatMessageHandler,
        providerConfig,
        connection
      );

      try {
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${handlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        // Batch 1
        const response = await handler._sync(api, syncPosition);

        // Make sure group and message limit were respected
        let groupMessages: Record<string, SchemaSocialChatMessage[]> = {}
        let groups: SchemaSocialChatGroup[] = []
        for (const result of (<any[]> response.results)) {
          if (result.groupId) {
            if (!groupMessages[result.groupId]) {
              groupMessages[result.groupId] = []
            }

            groupMessages[result.groupId].push(result)
          } else {
            groups.push(result)
          }
        }

        assert.equal(groups.length, providerConfig.groupLimit, "Group limit is expected value")
        assert.equal(response.results.length - groups.length, providerConfig.messageBatchSize, "Total returned messages is expected value")

        for (const group of groups) {
          const groupId = `${testConfig.idPrefix}-${group.sourceId}`
          const groupMessageCount = groupMessages[groupId].length
          assert.equal(groupMessageCount, providerConfig.messagesPerGroupLimit, `Total messages in group ${group.name} is correct (${groupMessageCount})`)
        }
      } catch (err) {
        // ensure provider closes even if there's an error
        await provider.close()
  
        throw err
      }
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
