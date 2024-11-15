import axios from 'axios';
import CONFIG from "../../config";
import { BaseHandlerConfig, SyncHandlerPosition, SyncItemsBreak, SyncItemsResult, SyncProviderLogLevel } from '../../interfaces';
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";

import {
  SyncResponse,
  SyncHandlerStatus,
  ProviderHandlerOption,
  ConnectionOptionType,
} from "../../interfaces";
import { SchemaMeetingTranscript } from "../../schemas";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";
import BaseSyncHandler from '../BaseSyncHandler';

const MAX_BATCH_SIZE = 50; // Maximum limit for Fireflies API queries

export interface SyncTranscriptItemsResult extends SyncItemsResult {
  items: SchemaMeetingTranscript[];
}

export default class MeetingTranscriptHandler extends BaseSyncHandler {
  
  protected config: BaseHandlerConfig;

  public getLabel(): string {
    return "Meeting Transcript";
  }

  public getName(): string {
    return 'meeting-transcript';
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.MEETING_TRANSCRIPT;
  }

  public getProviderApplicationUrl() {
    return 'https://app.fireflies.ai/';
  }

  public getOptions(): ProviderHandlerOption[] {
    return [{
      id: 'dateRange',
      label: 'Transcript Date Range',
      type: ConnectionOptionType.ENUM,
      enumOptions: [{
        value: '1-month',
        label: '1 month'
      }, {
        value: '3-months',
        label: '3 months'
      }, {
        value: '6-months',
        label: '6 months'
      }],
      defaultValue: '3-months'
    }];
  }

  private async getFirefliesClient() {
    return axios.create({
      baseURL: 'https://api.fireflies.ai/graphql',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.connection.accessToken}`,
      },
    });
  }

  public async _sync(
    api: any,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    try {
      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
      }

      const client = await this.getFirefliesClient();
      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
      let items: SchemaMeetingTranscript[] = [];

      let currentRange = rangeTracker.nextRange();
      const query = `
        query Transcripts($limit: Int, $skip: Int, $userId: String, $fromDate: DateTime, $toDate: DateTime) {
          transcripts(limit: $limit, skip: $skip, user_id: $userId, fromDate: $fromDate, toDate: $toDate) {
            id
            title
            date
            speakers {
              id
              name
            }
            participants
            transcript_url
            duration
            summary {
              keywords
              action_items
              short_summary
            }
          }
        }
      `;

      const variables = {
        limit: this.config.batchSize,
        skip: currentRange.startId || 0,
        userId: this.config.userId,
        fromDate: this.config.fromDate,
        toDate: this.config.toDate,
      };

      const response = await client.post('', { query, variables });
      const resultData = await this.buildResults(response.data.data.transcripts, currentRange.endId);

      items = resultData.items;

      if (!items.length) {
        syncPosition.syncMessage = `No transcripts found within specified range.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage = `Fetched ${items.length} transcripts.`;
      }

      syncPosition.thisRef = rangeTracker.export();

      return {
        results: items,
        position: syncPosition,
      };
    } catch (err: any) {
      if (err.response && err.response.status == 403) {
        throw new AccessDeniedError(err.message);
      } else if (err.response && err.response.status == 401) {
        throw new InvalidTokenError(err.message);
      }
      throw err;
    }
  }

  protected async buildResults(
    transcripts: any[],
    breakId: string
  ): Promise<SyncTranscriptItemsResult> {
    const results: SchemaMeetingTranscript[] = [];
    let breakHit: SyncItemsBreak;

    for (const transcript of transcripts) {
      const transcriptId = transcript.id;

      if (transcriptId === breakId) {
        this.emit('log', {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId})`
        });
        breakHit = SyncItemsBreak.ID;
        break;
      }

      results.push({
          _id: this.buildItemId(transcriptId),
          name: transcript.title || 'Untitled meeting',
          organizerEmail: transcript.organizerEmail,
          insertedAt: new Date().toISOString(),
          duration: transcript.duration,
      });
    }

    return {
      items: results,
      breakHit,
    };
  }
}
