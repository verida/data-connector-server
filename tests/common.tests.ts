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
  // Attribute in the results that is used for time ordering (ie: insertedAt)
  timeOrderAttribute?: string; // Made optional
  // Attribute used to limit the batch size (ie: batchLimit)
  batchSizeLimitAttribute: string;
  // Prefix used for record ID's (override default which is providerName)
  idPrefix?: string;
}

// info,debug,error
const logLevelArg = process.argv.find((arg) => arg.startsWith("--logLevel="));
const logLevel = logLevelArg ? logLevelArg.split("=")[1] : undefined;

let provider: BaseProvider, connection: Connection;

export class CommonTests {
  static async runSyncTest(
    providerName: string,
    handlerType: typeof BaseSyncHandler,
    connection: Connection,
    testConfig: GenericTestConfig = {
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    },
    syncPositionConfig: Omit<SyncHandlerPosition, "_id">,
    providerConfig?: Omit<BaseProviderConfig, "sbtImage" | "label">
  ): Promise<SyncResponse> {
    const { api, handler, schemaUri } = await this.buildTestObjects(
      providerName,
      handlerType,
      providerConfig,
      connection
    );

    const syncPosition: SyncHandlerPosition = {
      _id: `${providerName}-${schemaUri}`,
      ...syncPositionConfig,
    };

    CommonUtils.setupHandlerLogging(handler, <SyncProviderLogLevel>logLevel);

    return handler._sync(api, syncPosition);
  }

  static async buildTestObjects(
    providerName: string,
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
      connection = await CommonUtils.getConnection(providerName);
    }

    provider = providers(providerName, network.context, connection);

    const handler = await provider.getSyncHandler(handlerType);
    const schemaUri = handler.getSchemaUri();

    CommonUtils.setupHandlerLogging(handler, <SyncProviderLogLevel>logLevel);

    const api = await provider.getApi(
      connection.accessToken,
      connection.refreshToken
    );

    const handlerConfig = {
      ...serverconfig.providers[providerName],
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
    providerName: string,
    handlerType: typeof BaseSyncHandler,
    testConfig: GenericTestConfig = {
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    },
    providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {},
    connection?: Connection
  ): Promise<{
    api: any;
    handler: BaseSyncHandler;
    provider: BaseProvider;
  }> {
    // * - New items are processed
    //    * - Backfill items are processed
    //    * - Not enough new items? Process backfill
    //    * - Backfill twice doesn't process the same items
    //    * - No more backfill produces empty rangeTracker

    // Set result limit to 3 results so page tests can work correctly
    providerConfig[testConfig.batchSizeLimitAttribute] = 3;

    const { api, handler, schemaUri, provider } = await this.buildTestObjects(
      providerName,
      handlerType,
      providerConfig,
      connection
    );

    const idPrefix = testConfig.idPrefix
      ? testConfig.idPrefix
      : `${provider.getProviderName()}-${connection!.profile.id}`;

    try {
      const syncPosition: SyncHandlerPosition = {
        _id: `${providerName}-${schemaUri}`,
        providerName,
        handlerName: handler.getName(),
        providerId: provider.getProviderId(),
        status: SyncHandlerStatus.SYNCING,
      };
      
      // 1. Test new items are processed
      const response = await handler._sync(api, syncPosition);
      const results = <SchemaRecord[]>response.results;

      // console.log(response.position)
      // console.log(CommonTests.outputItems(results, testConfig.timeOrderAttribute))

      assert.ok(results && results.length, "Have results returned");
      assert.equal(
        providerConfig[testConfig.batchSizeLimitAttribute],
        results.length,
        "Have correct number of results returned on page 1"
      );

      if (testConfig.timeOrderAttribute) {
        assert.ok(
          results[0][testConfig.timeOrderAttribute] >
            results[1][testConfig.timeOrderAttribute],
          "Results are most recent first"
        );
      }

      CommonTests.checkItem(results[0], handler, provider)

      assert.equal(
        SyncHandlerStatus.SYNCING,
        response.position.status,
        "Sync is active"
      );
      assert.ok(response.position.thisRef, "Have a defined processing range");

      const currentRangeParts = response.position.thisRef!.split(':')
      assert.ok(currentRangeParts.length == 2, "Have correct number of parts for the processing range");
      assert.ok(currentRangeParts[0] == results[0]._id.replace(`${idPrefix}-`, ''), "Have correct break ID");
      assert.ok(currentRangeParts[1].length, "Have an end range");

      // 2. Backfill items are processed
      const syncPosition2 = response.position
      const response2 = await handler._sync(api, syncPosition2);
      const results2 = <SchemaRecord[]>response2.results;
      
      // console.log(response2.position)
      // console.log(CommonTests.outputItems(results2, testConfig.timeOrderAttribute))

      assert.ok(
        results2 && results2.length,
        "Have backfill results returned"
      );
      assert.ok(
        results2 &&
          results2.length == providerConfig[testConfig.batchSizeLimitAttribute],
        "Have correct number of results returned in second page"
      );

      if (testConfig.timeOrderAttribute) {
        assert.ok(
          results2[0][testConfig.timeOrderAttribute] >
            results2[1][testConfig.timeOrderAttribute],
          "Results are most recent first"
        );
        assert.ok(
          results2[0][testConfig.timeOrderAttribute] <
            results[2][testConfig.timeOrderAttribute],
          "First item on second page of results have earlier timestamp than last item on first page"
        );
      }

      assert.equal(
        response2.position.status,
        SyncHandlerStatus.SYNCING,
        "Sync is active"
      );

      assert.ok(response2.position.thisRef, "Have a defined processing range");

      const currentRangeParts2 = response2.position.thisRef!.split(':')
      assert.ok(currentRangeParts2.length == 2, "Have correct number of parts for the processing range");
      assert.ok(currentRangeParts2[0] == results[0]._id.replace(`${idPrefix}-`, ''), "Have correct break ID matching the very first result");
      assert.ok(currentRangeParts2[1].length, "Have an end range");
      assert.ok(results[0]._id != results2[0]._id, "Have different result IDs")

      // 3. Not enough new items? Process backfill
      const syncPosition3 = response2.position
      syncPosition3.thisRef = `${results[1].sourceId}:${currentRangeParts2[1]}` // Ensure the first item (only) is fetched
      const response3 = await handler._sync(api, syncPosition3);
      const results3 = <SchemaRecord[]>response3.results;
      
      // console.log(response3.position)
      // console.log(CommonTests.outputItems(results3, testConfig.timeOrderAttribute))

      assert.ok(
        results3 && results3.length,
        "Have results returned"
      );
      assert.ok(
        results3 &&
        results3.length == providerConfig[testConfig.batchSizeLimitAttribute],
        "Have correct number of results returned"
      );
      assert.equal(results3[0]._id, results[0]._id, 'First result item matches the very first item')
      assert.ok(results3[1]._id != results[1]._id, 'Second result item does not match the very first batch second item')

      if (testConfig.timeOrderAttribute) {
        assert.ok(
          results3[0][testConfig.timeOrderAttribute] >
            results3[1][testConfig.timeOrderAttribute],
          "Results are most recent first"
        );
        // this will break?
        assert.ok(
          results3[2][testConfig.timeOrderAttribute] <
            results[2][testConfig.timeOrderAttribute],
          "Last item on return results have earlier timestamp than last item on first page"
        );
      }

      assert.equal(
        response3.position.status,
        SyncHandlerStatus.SYNCING,
        "Sync is active"
      );

      assert.ok(response3.position.thisRef, "Have a defined processing range");

      const currentRangeParts3 = response3.position.thisRef!.split(':')
      assert.ok(currentRangeParts3.length == 2, "Have correct number of parts for the processing range");
      assert.ok(currentRangeParts3[0] == results3[0]._id.replace(`${idPrefix}-`, ''), "Have correct break ID matching the very first result");
      assert.ok(currentRangeParts3[1].length, "Have an end range");
      assert.ok(currentRangeParts3[1] != currentRangeParts2[1], "End range has changed between batches");

      // - Backfill twice doesn't process the same items
      const syncPosition4 = response3.position
      const response4 = await handler._sync(api, syncPosition4);
      const results4 = <SchemaRecord[]>response4.results;
      
      // console.log(response4.position)
      // console.log(CommonTests.outputItems(results4, testConfig.timeOrderAttribute))

      assert.ok(
        results4 && results4.length,
        "Have results returned"
      );
      assert.ok(
        results4 &&
        results4.length == providerConfig[testConfig.batchSizeLimitAttribute],
        "Have correct number of results returned"
      );

      if (testConfig.timeOrderAttribute) {
        assert.ok(
          results4[0][testConfig.timeOrderAttribute] >
          results4[1][testConfig.timeOrderAttribute],
          "Results are most recent first"
        );
        // this will break?
        assert.ok(
          results4[0][testConfig.timeOrderAttribute] <
            results[2][testConfig.timeOrderAttribute],
          "First item on return results have earlier timestamp than last item on first page"
        );
      }

      assert.ok(results4[0]._id != results3[0]._id, "First items dont match between batches")

      assert.equal(
        response4.position.status,
        SyncHandlerStatus.SYNCING,
        "Sync is active"
      );

      assert.ok(response4.position.thisRef, "Have a defined processing range");
      const currentRangeParts4 = response4.position.thisRef!.split(':')
      assert.ok(currentRangeParts4.length == 2, "Have correct number of parts for the processing range");
      assert.ok(currentRangeParts4[1].length, "Have an end range");

      // @todo: No more backfill produces empty rangeTracker and SyncHandlerStatus.CONNECTED


      // Close the provider connection
      await provider.close();

      return {
        api,
        handler,
        provider,
      };
    } catch (err) {
      // ensure provider closes even if there's an error
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
      provider.getProviderId(),
      "Items have correct source account / provider id"
    );
    assert.ok(item.sourceId, "Items have sourceId set");
    assert.ok(item.sourceData, "Items have sourceData set");
  }

  // Helper method to output items to help with debugging
  static outputItems(items: SchemaRecord[], timeAttribute?: string) {
    for (const item of items) {
      console.log(item._id, timeAttribute ? item[timeAttribute] : '', item.name)
    }
  }
}
