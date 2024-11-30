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
import { FireFliesClient } from './api';

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

  public async _sync(
    api: any,
    syncPosition: SyncHandlerPosition
  ): Promise<SyncResponse> {
    
    try {
      if (this.config.batchSize > MAX_BATCH_SIZE) {
        throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
      }

      const client = new FireFliesClient({
        apiKey: this.connection.accessToken
      });

      const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
      let items: SchemaMeetingTranscript[] = [];

      let currentRange = rangeTracker.nextRange();

      const query = `
        query Transcripts($limit: Int, $skip: Int) {
          transcripts(limit: $limit, skip: $skip) {
            id
            title
            organizer_email
            user {
              email
              name
            }
            date            
            speakers {
              id
              name
            }
            sentences {
              speaker_name
              raw_text
            }
            meeting_attendees {
              displayName
              email
              phoneNumber
              name
            }           
            duration
            summary {              
              short_summary
            }
            cal_id
          }
        }
      `;

      const variables = {
        limit: this.config.batchSize,
        skip: currentRange.startId || 0      
      };

      const response = await client.executeQuery<any>(query, variables)

      const resultData = await this.buildResults(response.data.transcripts, currentRange.endId);

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
    let breakHit: SyncItemsBreak | undefined;
  
    for (const transcript of transcripts) {
      const transcriptId = transcript.id;
  
      // Check for the break ID to stop processing
      if (transcriptId === breakId) {
        this.emit('log', {
          level: SyncProviderLogLevel.DEBUG,
          message: `Break ID hit (${breakId})`,
        });
        breakHit = SyncItemsBreak.ID;
        break;
      }
  
      // Map transcript fields to SchemaMeetingTranscript
      results.push({
        _id: this.buildItemId(transcriptId), // Unique ID for each transcript
        name: transcript.title || 'Untitled meeting',
        organizerEmail: transcript.organizer_email,
        user: transcript.user
          ? {
              email: transcript.user.email,
              displayName: transcript.user.name || 'Unknown',
              name: transcript.user.name || undefined,
            }
          : undefined,
        speakers: transcript.speakers
          ? transcript.speakers.map((speaker: any) => ({
              displayName: speaker.name,
              email: speaker?.email,
            }))
          : [],
        meetingAttendees: transcript.meeting_attendees
          ? transcript.meeting_attendees.map((attendee: any) => ({
              displayName: attendee.displayName,
              email: attendee.email,
              phoneNumber: attendee.phoneNumber,
              name: attendee.name,
            }))
          : [],
        duration: transcript.duration,
        dateTime: transcript.date || undefined,
        sentence: transcript.sentences
          ? transcript.sentences.map((sentence: any) => ({
              rawText: sentence.raw_text,
              speakerName: sentence.speaker_name,
            }))
          : [],
        calendarEventId: transcript.cal_id || undefined,
        insertedAt: new Date().toISOString(), // Add the current timestamp
      });
    }
  
    return {
      items: results,
      breakHit, // Indicates if a break ID was encountered
    };
  }  
}
