const assert = require("assert");
import {
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus,
} from "../../../../src/interfaces";
import Providers from "../../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../../common.utils";

import RedditPostHandler from "../../../../src/providers/reddit/post";
import BaseProvider from "../../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../../common.tests";
import { RedditConfig, RedditPostType } from "../../../../src/providers/reddit/types";

const providerId = "reddit";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "post";
let testConfig: GenericTestConfig;
let providerConfig: Omit<
  RedditConfig,
  "sbtImage" | "label" | "apiId" | "apiHash"
> = {
};

describe(`${providerId} post tests`, function () {
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
        RedditPostHandler,
        providerConfig,
        connection
      );

      handler.setConfig({
        postType: RedditPostType.UPVOTED,
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
        assert(response.results.length > 0, "No posts fetched");

        // Batch 2
        response = await handler._sync(api, syncPosition);
        assert(response.results.length > 0, "No posts fetched");
      } catch (err) {
        // ensure provider closes even if there's an error
        await provider.close();

        throw err;
      }

      handler.setConfig({
        postType: RedditPostType.CREATED,
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
        assert(response.results.length > 0, "No posts fetched");
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
