const assert = require("assert");
import {
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus,
} from "../../../../src/interfaces";
import Providers from "../../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../../common.utils";

import RedditMessageHandler from "../../../../src/providers/reddit/message";
import BaseProvider from "../../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../../common.tests";
import {
  SchemaSocialChatGroup,
  SchemaSocialChatMessage,
} from "../../../../src/schemas";
import { RedditConfig } from "../../../../src/providers/reddit/types";

const providerId = "reddit";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "message";
let testConfig: GenericTestConfig;
let providerConfig: Omit<
  RedditConfig,
  "sbtImage" | "label" | "apiId" | "apiHash"
> = {
  maxSyncLoops: 1,
};

// Tests:
// - max age days respected

describe(`${providerId} message tests`, function () {
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
        RedditMessageHandler,
        providerConfig,
        connection
      );

      handler.setConfig({
        batchSize: 10,
      })

      try {
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${handlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        // Batch 1
        let response = await handler._sync(api, syncPosition);
        assert(response.results.length > 0, "No messages fetched");

        // Batch 2
        response = await handler._sync(api, syncPosition);
        assert(response.results.length > 0, "No messages fetched");
      } catch (err) {
        // ensure provider closes even if there's an error
        await provider.close();

        throw err;
      }

      handler.setConfig({
        messageType: "unread",
        batchSize: 100,
      });

      try {
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${handlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        const response = await handler._sync(api, syncPosition);
        assert(response.results.length > 0, "No messages fetched");
        console.log(response.results);
      } catch (err) {
        // ensure provider closes even if there's an error
        await provider.close();

        throw err;
      }
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
});
