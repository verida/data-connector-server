const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus,
  SyncSchemaPositionType,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";

import TelegramChatMessageHandler from "../../../src/providers/telegram/chat-message";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { TelegramChatGroupType, TelegramConfig } from "../../../src/providers/telegram/interfaces";
import { SchemaRecord, SchemaSocialChatGroup, SchemaSocialChatMessage } from "../../../src/schemas";

const providerName = "telegram";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "chat-message";
let testConfig: GenericTestConfig;
let providerConfig: Omit<TelegramConfig, "sbtImage" | "label" | "apiId" | "apiHash"> = {
  maxSyncLoops: 1,
  groupLimit: 1,
  messageMaxAgeDays: 7,
  messageBatchSize: 10,
  messagesPerGroupLimit: 10,
  supportedChatGroupTypes: [TelegramChatGroupType.BASIC, TelegramChatGroupType.PRIVATE],
  useDbPos: false
};

// Tests:
// - group limit respected
// - max age days respected
// - message batch size respected
// - messages per group limit respected

describe(`${providerName} chat tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerName);
    provider = Providers(providerName, network.context, connection);
    
    testConfig = {
      idPrefix: `${provider.getProviderName()}-${connection.profile.id}`,
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerName} data`, () => {

    it(`Can pass basic tests: ${handlerName}`, async () => {
      const { api, handler, schemaUri, provider } = await CommonTests.buildTestObjects(
        providerName,
        TelegramChatMessageHandler,
        providerConfig,
        connection
      );

      try {
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerName}-${handlerName}`,
          type: SyncSchemaPositionType.SYNC,
          providerName,
          handlerName: handler.getName(),
          providerId: provider.getProviderId(),
          status: SyncHandlerStatus.ACTIVE,
        };
        console.log(syncPosition)

        // Batch 1
        const response = await handler._sync(api, syncPosition);

        // Make sure group and message limit were respected
        let groupMessages: Record<string, SchemaSocialChatMessage[]> = {}
        let groups: SchemaSocialChatGroup[] = []
        for (const result of (<any[]> response.results)) {
          if (result.chatGroupId) {
            if (!groupMessages[result.chatGroupId]) {
              groupMessages[result.chatGroupId] = []
            }

            groupMessages[result.chatGroupId].push(result)
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

        // console.log(response)
        return
  
        const results = <SchemaRecord[]>response.results;
  
        assert.ok(results && results.length, "Have results returned");
        assert.equal(3, results.length,
          "Have correct number of results returned on page 1"
        );
  
        assert.ok(
          results[0][testConfig.timeOrderAttribute] >
            results[1][testConfig.timeOrderAttribute],
          "Results are most recent first"
        );
  
        assert.equal(results[0].sourceApplication, handler.getProviderApplicationUrl(), "Items have correct source application")
        assert.equal(results[0].sourceAccountId, provider.getProviderId(), "Items have correct source account / provider id")
        assert.ok(results[0].sourceId, "Items have sourceId set")
        assert.ok(results[0].sourceData, "Items have sourceData set")
  
        assert.equal(
          SyncHandlerStatus.ACTIVE,
          response.position.status,
          "Sync is set to connected"
        );
        assert.ok(response.position.thisRef, "Have a next page reference");
        assert.equal(response.position.breakId, undefined, "Break ID is undefined");
        assert.equal(
          `${idPrefix}-${response.position.futureBreakId}`,
          results[0]._id,
          "Future break ID matches the first result ID"
        );
  
        // // Snapshot: Page 2
        // const response2 = await handler._sync(api, syncPosition);
        // const results2 = <SchemaRecord[]>response2.results;
  
        // assert.ok(
        //   results2 && results2.length,
        //   "Have second page of results returned"
        // );
        // assert.ok(
        //   results2 && results2.length == 3,
        //   "Have correct number of results returned in second page"
        // );
        // assert.ok(
        //   results2[0][testConfig.timeOrderAttribute] >
        //     results2[1][testConfig.timeOrderAttribute],
        //   "Results are most recent first"
        // );
        // assert.ok(
        //   results2[0][testConfig.timeOrderAttribute] <
        //     results[2][testConfig.timeOrderAttribute],
        //   "First item on second page of results have earlier timestamp than last item on first page"
        // );
  
        // assert.equal(
        //   response.position.status,
        //   SyncHandlerStatus.ACTIVE,
        //   "Sync is still active"
        // );
        // assert.ok(response.position.thisRef, "Have a next page reference");
        // // assert.equal(PostSyncRefTypes.Url, response.position.thisRefType, 'This position reference type is URL fetch')
        // assert.equal(response.position.breakId, undefined, "Break ID is undefined");
        // assert.equal(
        //   results[0]._id,
        //   `${idPrefix}-${response.position.futureBreakId}`,
        //   "Future break ID matches the first result ID"
        // );
  
        // // Update: Page 1 (ensure 1 result only)
        // // Fetch the update set of results to confirm `position.pos` is correct
        // // Make sure we fetch the first post only, by setting the break to the second item
        // const position = response2.position;
        // position.thisRef = undefined;
        // // position.thisRefType = PostSyncRefTypes.Api
        // position.breakId = results[1]._id.replace(`${idPrefix}-`, "");
        // position.futureBreakId = undefined;
  
        // const response3 = await handler._sync(api, position);
        // const results3 = <SchemaRecord[]>response3.results;
        // assert.equal(results3.length, 1, "1 result returned");
        // assert.equal(results3[0]._id, results[0]._id, "Correct ID returned");
  
        // assert.equal(
        //   response.position.status,
        //   SyncHandlerStatus.STOPPED,
        //   "Sync is stopped"
        // );
        // assert.equal(
        //   response.position.thisRef,
        //   undefined,
        //   "No next page reference"
        // );
        // // assert.equal(PostSyncRefTypes.Api, response.position.thisRefType, 'This position reference type is API fetch')
        // assert.equal(
        //   response.position.breakId,
        //   results3[0]._id.replace(`${idPrefix}-`, ""),
        //   "Break ID is the first result"
        // );
        // assert.equal(
        //   response.position.futureBreakId,
        //   undefined,
        //   "Future break ID is undefined"
        // );
  
        // Close the provider connection
        console.log('closing provider')
        await provider.close()
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
