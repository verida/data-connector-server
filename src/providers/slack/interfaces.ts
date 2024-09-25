import { BaseHandlerConfig, BaseProviderConfig } from "../../interfaces";

export interface SlackHandlerConfig extends BaseHandlerConfig {
  // Maximum number of groups to process
  groupLimit: number,
  // Maximum number of messages to process in a given batch
  messageBatchSize: number
  // Maximum number of messages to process in a group
  messagesPerGroupLimit: number
}

export interface SlackProviderConfig extends BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  stateSecret: string;
  callbackUrl: string;
}

export enum SlackChatGroupType {
  CHANNEL = "channel", // Public channel
  GROUP = "group", // Private channel
  IM = "im", // DM
  MPIM = "mpim" // Multi-person DM
}