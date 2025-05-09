const assert = require("assert");
import {
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus,
} from "../../../../src/interfaces";
import Providers from "../../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../../common.utils";

import RedditCommentHandler from "../../../../src/providers/reddit/comment";
import RedditUserCommentHandler from "../../../../src/providers/reddit/userComment";
import BaseProvider from "../../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../../common.tests";
import {
  RedditCommentType,
  RedditConfig,
} from "../../../../src/providers/reddit/types";

const providerId = "reddit";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "comment";
let otherHandlerName = "userComment";
let testConfig: GenericTestConfig;
let providerConfig: Omit<
  RedditConfig,
  "sbtImage" | "label" | "apiId" | "apiHash"
> = {};

describe(`${providerId} comment tests`, function () {
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
        RedditCommentHandler,
        providerConfig,
        connection
      );

      const me = await api.getMe();

      handler.setConfig({
        commentType: RedditCommentType.UPVOTED,
        batchSize: 10,
      });

      try {
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${me.name}-${handlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        // Batch 1
        let response = await handler._sync(api, syncPosition);
        assert(
          response.results.length === 10,
          "Not batch amount comments fetched"
        );

        // Batch 2
        response = await handler._sync(api, syncPosition);
        assert(response.results.length <= 10, "No comments fetched");
      } catch (err) {
        // ensure provider closes even if there's an error
        await provider.close();

        throw err;
      }
    });

    it(`Can pass basic tests: ${otherHandlerName}`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        RedditUserCommentHandler,
        providerConfig,
        connection
      );

      const me = await api.getMe();

      try {
        const syncPosition: SyncHandlerPosition = {
          _id: `${providerId}-${me.name}-${otherHandlerName}`,
          providerId,
          handlerId: handler.getId(),
          accountId: provider.getAccountId(),
          status: SyncHandlerStatus.ENABLED,
        };

        const response = await handler._sync(api, syncPosition);
        assert(response.results.length > 0, "No comments fetched");
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
