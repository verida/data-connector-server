import {
  BaseProviderConfig,
  Connection,
  SyncHandlerStatus,
  SyncResponse,
  SyncSchemaPosition,
  SyncSchemaPositionType,
  SyncStatus,
} from "../src/interfaces";
import providers from "../src/providers";
import BaseProvider from "../src/providers/BaseProvider";
import BaseSyncHandler from "../src/providers/BaseSyncHandler";
import { SchemaRecord } from "../src/schemas";
import serverconfig from "../src/serverconfig.json";
import CommonUtils from "./common.utils";
const assert = require("assert");

export interface GenericTestConfig {
  // Attribute in the results that is used for time ordering (ie: insertedAt)
  timeOrderAttribute: string;
  // Attribute used to limit the batch size (ie: batchLimit)
  batchSizeLimitAttribute: string;
  // Prefix used for record ID's (override default which is providerName)
  idPrefix?: string;
}

let provider: BaseProvider, connection: Connection

export class CommonTests {
  static async runSyncTest(
    providerName: string,
    handlerType: typeof BaseSyncHandler,
    testConfig: GenericTestConfig = {
      timeOrderAttribute: "insertedAt",
      batchSizeLimitAttribute: "batchSize",
    },
    syncPositionConfig: Omit<SyncSchemaPosition, "_id" | "schemaUri">,
    providerConfig?: Omit<BaseProviderConfig, "sbtImage" | "label">
  ): Promise<SyncResponse> {
    const { api, handler, schemaUri } = await this.buildTestObjects(
      providerName,
      handlerType,
      providerConfig
    );

    const syncPosition: SyncSchemaPosition = {
      _id: `${providerName}-${schemaUri}`,
      schemaUri,
      ...syncPositionConfig,
    };

    return handler._sync(api, syncPosition);
  }

  static async buildTestObjects(
    providerName: string,
    handlerType: typeof BaseSyncHandler,
    providerConfig?: Omit<BaseProviderConfig, "sbtImage" | "label">,
    connection?: Connection
  ) {
    const network = await CommonUtils.getNetwork();
    if (!connection) {
      connection = await CommonUtils.getConnection(providerName);
    }

    provider = providers(providerName, network.context, connection);

    const handler = await provider.getSyncHandler(handlerType);
    const schemaUri = handler.getSchemaUri();

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
  ) {
    // Set result limit to 3 results so page tests can work correctly
    providerConfig[testConfig.batchSizeLimitAttribute] = 3;

    const { api, handler, schemaUri } = await this.buildTestObjects(
      providerName,
      handlerType,
      providerConfig,
      connection
    );

    const idPrefix = testConfig.idPrefix ? testConfig.idPrefix : providerName;

    const syncPosition: SyncSchemaPosition = {
      _id: `${providerName}-${schemaUri}`,
      type: SyncSchemaPositionType.SYNC,
      provider: providerName,
      schemaUri,
      status: SyncHandlerStatus.ACTIVE,
    };
    // Snapshot: Page 1
    const response = await handler._sync(api, syncPosition);

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
      SyncStatus.ACTIVE,
      response.position.status,
      "Sync is still active"
    );
    assert.ok(response.position.thisRef, "Have a next page reference");
    assert.equal(response.position.breakId, undefined, "Break ID is undefined");
    assert.equal(
      `${idPrefix}-${response.position.futureBreakId}`,
      results[0]._id,
      "Future break ID matches the first result ID"
    );

    // Snapshot: Page 2
    const response2 = await handler._sync(api, syncPosition);
    const results2 = <SchemaRecord[]>response2.results;

    assert.ok(
      results2 && results2.length,
      "Have second page of results returned"
    );
    assert.ok(
      results2 && results2.length == 3,
      "Have correct number of results returned in second page"
    );
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

    assert.equal(
      response.position.status,
      SyncStatus.ACTIVE,
      "Sync is still active"
    );
    assert.ok(response.position.thisRef, "Have a next page reference");
    // assert.equal(PostSyncRefTypes.Url, response.position.thisRefType, 'This position reference type is URL fetch')
    assert.equal(response.position.breakId, undefined, "Break ID is undefined");
    assert.equal(
      results[0]._id,
      `${idPrefix}-${response.position.futureBreakId}`,
      "Future break ID matches the first result ID"
    );

    // Update: Page 1 (ensure 1 result only)
    // Fetch the update set of results to confirm `position.pos` is correct
    // Make sure we fetch the first post only, by setting the break to the second item
    const position = response2.position;
    position.thisRef = undefined;
    // position.thisRefType = PostSyncRefTypes.Api
    position.breakId = results[1]._id.replace(`${idPrefix}-`, "");
    position.futureBreakId = undefined;

    const response3 = await handler._sync(api, position);
    const results3 = <SchemaRecord[]>response3.results;
    assert.equal(results3.length, 1, "1 result returned");
    assert.equal(results3[0]._id, results[0]._id, "Correct ID returned");

    assert.equal(
      response.position.status,
      SyncHandlerStatus.STOPPED,
      "Sync is stopped"
    );
    assert.equal(
      response.position.thisRef,
      undefined,
      "No next page reference"
    );
    // assert.equal(PostSyncRefTypes.Api, response.position.thisRefType, 'This position reference type is API fetch')
    assert.equal(
      response.position.breakId,
      results3[0]._id.replace(`${idPrefix}-`, ""),
      "Break ID is the first result"
    );
    assert.equal(
      response.position.futureBreakId,
      undefined,
      "Future break ID is undefined"
    );
  }
}
