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
  batchSizeLimitAttribute?: string;
  // Prefix used for record ID's (override default which is providerName)
  idPrefix?: string;
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
    },
    syncPositionConfig: Omit<SyncHandlerPosition, "_id">,
    providerConfig?: Omit<BaseProviderConfig, "sbtImage" | "label">,
    handlerId?: string
  ): Promise<SyncResponse> {
    const { api, handler, schemaUri } = await this.buildTestObjects(
      providerId,
      handlerType,
      handlerId,
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
    handlerId?: string,    
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
      ...(handlerId ? serverconfig.providers[providerId]["handlers"][handlerId] : {}),
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
    },
    providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {},
    handlerId: string,
    connection?: Connection
  ): Promise<{
    api: any;
    handler: BaseSyncHandler;
    provider: BaseProvider;
  }> {
    
    const { api, handler, schemaUri, provider } = await this.buildTestObjects(
      providerId,
      handlerType,
      handlerId,
      providerConfig,
      connection
    );

    try {
      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${schemaUri}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.SYNCING,
      };

      const response = await handler._sync(api, syncPosition);
      const results = <SchemaRecord[]>response.results;

      assert.ok(results && results.length, "Have results returned");
      if (testConfig.batchSizeLimitAttribute) {
        assert.equal(
          providerConfig[testConfig.batchSizeLimitAttribute],
          results.length,
          "Have correct number of results returned on page 1"
        );
      }

      if (testConfig.timeOrderAttribute) {
        assert.ok(
          results[0][testConfig.timeOrderAttribute] >
          results[1][testConfig.timeOrderAttribute],
          "Results are most recent first"
        );
      }

      CommonTests.checkItem(results[0], handler, provider)

      assert.equal(
        SyncHandlerStatus.ENABLED,
        response.position.status,
        "Sync is active"
      );
      
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
      provider.getAccountId(),
      "Items have correct source account / account id"
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
