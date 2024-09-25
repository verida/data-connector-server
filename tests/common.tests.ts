import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncResponse,
  SyncHandlerPosition,
  SyncProviderLogLevel,
} from "../src/interfaces";
import providers from "../src/providers";
import BaseProvider from "../src/providers/BaseProvider";
import BaseSyncHandler from "../src/providers/BaseSyncHandler";
import { SchemaRecord } from "../src/schemas";
import serverconfig from "../src/config";
import CommonUtils from "./common.utils";
const assert = require("assert");

export interface GenericTestConfig {
  timeOrderAttribute?: string; // Optional, used for time ordering
  batchSizeLimitAttribute: string; // Used for limiting the batch size
  idPrefix?: string; // Prefix for record ID's
  resultsPerPage?: number; // Number of items per page
  pageCount?: number; // Number of pages to fetch
  allowBackfill?: boolean; // Whether backfill is allowed
}

// info,debug,error
const logLevelArg = process.argv.find((arg) => arg.startsWith("--logLevel="));
const logLevel = logLevelArg ? logLevelArg.split("=")[1] : undefined;

let provider: BaseProvider, connection: Connection;

export class CommonTests {
  static async runSyncTest(
    providerId: string,
    handlerType: typeof BaseSyncHandler,
    connection: Connection,
    testConfig: GenericTestConfig = {
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
      resultsPerPage: 2, // Default results per page
      pageCount: 2, // Default number of pages
      allowBackfill: true, // Allow backfill by default
    },
    syncPositionConfig: Omit<SyncHandlerPosition, "_id">,
    providerConfig?: Omit<BaseProviderConfig, "sbtImage" | "label">
  ): Promise<SyncResponse> {
    const { api, handler, schemaUri } = await this.buildTestObjects(
      providerId,
      handlerType,
      providerConfig,
      connection
    );

    const syncPosition: SyncHandlerPosition = {
      _id: `${providerId}-${schemaUri}`,
      ...syncPositionConfig,
    };

    CommonUtils.setupHandlerLogging(handler, <SyncProviderLogLevel>logLevel);

    return handler._sync(api, syncPosition);
  }

  static async buildTestObjects(
    providerId: string,
    handlerType: typeof BaseSyncHandler,
    providerConfig?: Omit<BaseProviderConfig, "sbtImage" | "label">,
    connection?: Connection
  ): Promise<{
    api: any;
    provider: BaseProvider;
    handler: BaseSyncHandler;
    schemaUri: string;
  }> {
    const network = await CommonUtils.getNetwork();
    if (!connection) {
      connection = await CommonUtils.getConnection(providerId);
    }

    provider = providers(providerId, network.context, connection);

    const handler = await provider.getSyncHandler(handlerType);
    const schemaUri = handler.getSchemaUri();

    CommonUtils.setupHandlerLogging(handler, <SyncProviderLogLevel>logLevel);

    const api = await provider.getApi(
      connection.accessToken,
      connection.refreshToken
    );

    const handlerConfig = {
      ...serverconfig.providers[providerId],
      ...providerConfig,
    };
    handler.setConfig(handlerConfig);

    return {
      api,
      provider,
      handler,
      schemaUri,
    };
  }

  static async runGenericTests(
    providerId: string,
    handlerType: typeof BaseSyncHandler,
    testConfig: GenericTestConfig = {
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
      resultsPerPage: 3, // Default to 3 results per page
      pageCount: 2, // Default to 2 pages
      allowBackfill: true, // Backfill allowed by default
    },
    providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {},
    connection?: Connection
  ): Promise<{
    api: any;
    handler: BaseSyncHandler;
    provider: BaseProvider;
  }> {
    // Set result limit to resultsPerPage from testConfig
    providerConfig[testConfig.batchSizeLimitAttribute] = testConfig.resultsPerPage!;

    const { api, handler, schemaUri, provider } = await this.buildTestObjects(
      providerId,
      handlerType,
      providerConfig,
      connection
    );

    const idPrefix = testConfig.idPrefix
      ? testConfig.idPrefix
      : `${provider.getProviderName()}-${connection!.profile.id}`;

    try {
      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${schemaUri}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.SYNCING,
      };
      
      // 1. Test new items are processed
      const response = await handler._sync(api, syncPosition);
      const results = <SchemaRecord[]>response.results;

        assert.ok(results && results.length, `Page ${page + 1}: Have results returned`);
        assert.equal(
          providerConfig[testConfig.batchSizeLimitAttribute],
          results.length,
          `Page ${page + 1}: Have correct number of results returned`
        );

        if (testConfig.timeOrderAttribute) {
          assert.ok(
            results[0][testConfig.timeOrderAttribute] >
              results[1][testConfig.timeOrderAttribute],
            `Page ${page + 1}: Results are most recent first`
          );
        }

        CommonTests.checkItem(results[0], handler, provider);

        assert.equal(
          SyncHandlerStatus.SYNCING,
          response.position.status,
          `Page ${page + 1}: Sync is active`
        );
        assert.ok(response.position.thisRef, `Page ${page + 1}: Have a defined processing range`);

        const currentRangeParts = response.position.thisRef!.split(":");
        assert.ok(currentRangeParts.length == 2, "Have correct number of parts for the processing range");
        assert.ok(
          currentRangeParts[0] == results[0]._id.replace(`${idPrefix}-`, ""),
          `Page ${page + 1}: Have correct break ID`
        );
        assert.ok(currentRangeParts[1].length, "Have an end range");

        // Backfill logic
        if (testConfig.allowBackfill && results.length < providerConfig[testConfig.batchSizeLimitAttribute]) {
          const backfillResponse = await handler._sync(api, syncPosition);

          // Filter out items already processed in backfill
          const newBackfillResults = backfillResponse.results.filter(
            (item) => !processedBackfillItems.has(item)
          );

          if (newBackfillResults.length > 0) {
            console.log(`Backfill processed ${newBackfillResults.length} new items on page ${page + 1}`);
            newBackfillResults.forEach((item) => processedBackfillItems.add(item));
          }

          assert.ok(newBackfillResults.length, `Page ${page + 1}: Backfill has new results`);
        }

        // Update syncPosition for next page
        syncPosition = response.position;

        // Break the loop early if no more results are fetched
        if (!results.length) {
          break;
        }
      }

      // Close the provider connection
      await provider.close();

      return {
        api,
        handler,
        provider,
      };
    } catch (err) {
      // Ensure provider closes even if there's an error
      await provider.close();

      throw err;
    }
  }

  static checkItem(item: SchemaRecord, handler: BaseSyncHandler, provider: BaseProvider) {
    assert.equal(
      item.sourceApplication,
      handler.getProviderApplicationUrl(),
      "Items have correct source application"
    );
    assert.equal(
      item.sourceAccountId,
      provider.getAccountId(),
      "Items have correct source account / account id"
    );
    assert.ok(item.sourceId, "Items have sourceId set");
    assert.ok(item.sourceData, "Items have sourceData set");
  }

  // Helper method to output items to help with debugging
  static outputItems(items: SchemaRecord[], timeAttribute?: string) {
    for (const item of items) {
      console.log(item._id, timeAttribute ? item[timeAttribute] : "", item.name);
    }
  }
}
