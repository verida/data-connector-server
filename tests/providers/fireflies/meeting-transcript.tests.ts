const assert = require("assert");
import {
  BaseProviderConfig,
  Connection,
  SyncHandlerPosition,
  SyncHandlerStatus,
} from "../../../src/interfaces";
import Providers from "../../../src/providers";
import CommonUtils, { NetworkInstance } from "../../common.utils";
import MeetingTranscriptHandler from "../../../src/providers/fireflies/meeting-transcript";
import BaseProvider from "../../../src/providers/BaseProvider";
import { CommonTests, GenericTestConfig } from "../../common.tests";
import { SchemaMeetingTranscript } from "../../../src/schemas";

const providerId = "fireflies";
let network: NetworkInstance;
let connection: Connection;
let provider: BaseProvider;
let handlerName = "meeting-transcript";
let testConfig: GenericTestConfig;
let providerConfig: Omit<BaseProviderConfig, "sbtImage" | "label"> = {
  batchSize: 10
};

describe(`${providerId} Tests`, function () {
  this.timeout(100000);

  this.beforeAll(async function () {
    network = await CommonUtils.getNetwork();
    connection = await CommonUtils.getConnection(providerId);
    provider = Providers(providerId, network.context, connection);
    
    testConfig = {
      idPrefix: `${provider.getProviderName()}-${connection.profile.id}`,
      timeOrderAttribute: "dateTime",
      batchSizeLimitAttribute: "batchSize",
    };
  });

  describe(`Fetch ${providerId} data`, () => {
    it(`Can pass basic tests: ${handlerName}`, async () => {
      const { api, handler, provider } = await CommonTests.buildTestObjects(
        providerId,
        MeetingTranscriptHandler,
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

        // First batch
        const response = await handler._sync(api, syncPosition);
        assert.ok(response.results, "Have results");
        assert.ok(response.results.length <= providerConfig.batchSize, 
          "Results respect batch size limit");

        // Verify schema compliance
        const transcript = response.results[0] as SchemaMeetingTranscript;
        assert.ok(transcript._id, "Has _id");
        assert.ok(transcript.sourceId, "Has sourceId");
        assert.ok(transcript.title, "Has title");
        assert.ok(transcript.dateTime, "Has dateTime");
        assert.ok(transcript.transcript, "Has transcript");
        assert.ok(Array.isArray(transcript.attendees), "Has attendees array");

      } catch (err) {
        await provider.close();
        throw err;
      }
    });

    it(`Can limit results by timestamp`, async () => {
      const lastRecordHours = 24;
      const lastRecordTimestamp = new Date(
        Date.now() - lastRecordHours * 3600000
      ).toISOString();

      const syncPosition: Omit<SyncHandlerPosition, "_id"> = {
        providerId,
        handlerId: handlerName,
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      providerConfig.metadata = {
        breakTimestamp: lastRecordTimestamp,
      };

      const syncResponse = await CommonTests.runSyncTest(
        providerId,
        MeetingTranscriptHandler,
        connection,
        testConfig,
        syncPosition,
        providerConfig
      );

      assert.ok(
        syncResponse.results && syncResponse.results.length,
        "Have results (You may not have any meetings in the testing timeframe)"
      );

      const results = <SchemaMeetingTranscript[]>syncResponse.results;
      assert.ok(
        results[results.length - 1].dateTime > lastRecordTimestamp,
        "Last result is within expected date/time range"
      );
    });

    it('Handles API errors appropriately', async () => {
      const { handler } = await CommonTests.buildTestObjects(
        providerId,
        MeetingTranscriptHandler,
        providerConfig,
        connection
      );

      const mockApi = {
        executeQuery: async () => {
          throw { response: { status: 401 } };
        }
      };

      const syncPosition: SyncHandlerPosition = {
        _id: `${providerId}-${handlerName}`,
        providerId,
        handlerId: handler.getId(),
        accountId: provider.getAccountId(),
        status: SyncHandlerStatus.ENABLED,
      };

      try {
        await handler._sync(mockApi, syncPosition);
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err.name === 'InvalidTokenError', 'Throws correct error type');
      }
    });
  });

  this.afterAll(async function () {
    const { context } = await CommonUtils.getNetwork();
    await context.close();
  });
}); 