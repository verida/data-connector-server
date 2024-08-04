import { Connection, SyncSchemaPosition, ConnectionHandler, BaseProviderConfig } from "../../interfaces";

export interface GoogleProviderConfig extends BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
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

export interface GmailSyncSchemaPosition extends SyncSchemaPosition {
  metadata?: GmailSyncSchemaPositionMetadata;
}
