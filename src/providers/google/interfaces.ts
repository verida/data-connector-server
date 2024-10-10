import { Connection, SyncHandlerPosition, ConnectionHandler, BaseProviderConfig, BaseHandlerConfig } from "../../interfaces";

export interface GoogleProviderConfig extends BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  sizeLimit: number; //Mega bytes
}

export interface GoogleHandlerConfig extends BaseHandlerConfig {
  batchSize: number
  breakTimestamp: string
}

export interface GoogleDriveDocumentHandlerConfig extends GoogleHandlerConfig {
  sizeLimit: number
}

export interface GoogleConnectionHandler extends ConnectionHandler {
  config: GoogleHandlerConfig;
}

export interface GoogleProviderConnection extends Connection {
  handlers: GoogleConnectionHandler[];
}

export interface GmailSyncSchemaPositionMetadata {
  breakTimestamp?: string;
}

export interface GmailSyncSchemaPosition extends SyncHandlerPosition {
  metadata?: GmailSyncSchemaPositionMetadata;
}

export enum YoutubeActivityType {
  UPLOAD = "upload", // post
  LIKE = "like", // favourite
  SUBSCRIPTION = "subscription", // following
  FAVOURITE = "favourite", // favourite
  COMMENT = "comment", // ingored
  PLAYLIST_ITEM = "playlistItem", //ignored
  RECOMMENDATION = "recommendation", // favourite
}

export interface Person {
  email: string
  displayName?: string
}

export interface DateTimeInfo {
  dateTime: string;  // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
  timeZone?: string;  // UTC offset format: ±HH:MM
}

export interface CalendarAttachment {
  fileUrl?: string;   // URL of the file
  title?: string;     // Title of the attachment
  mimeType?: string;  // MIME type of the file
  iconLink?: string;  // URL of the icon representing the file
  fileId?: string;    // Unique identifier for the file
}

export interface GoogleCalendarHandlerConfig extends BaseHandlerConfig {
  calendarBatchSize?: number;  // Max number of calendar per sync
  eventBatchSize?: number; // Max number of event to process in a calendar
}