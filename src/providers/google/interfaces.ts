import { Connection, SyncHandlerPosition, ConnectionHandler, BaseProviderConfig } from "../../interfaces";

export interface GoogleProviderConfig extends BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  sizeLimit: number; //Mega bytes
}

export interface GmailHandlerConfig extends Record<"backdate", string> {}

export interface GoogleConnectionHandler extends ConnectionHandler {
  config: GmailHandlerConfig;
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