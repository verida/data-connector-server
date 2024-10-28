import { BaseHandlerConfig, BaseProviderConfig } from "../../interfaces";

export interface SlackHandlerConfig extends BaseHandlerConfig {
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
  PUBLIC_CHANNEL = "public_channel", // Public channel
  PRIVATE_CHANNEL = "private_channel", // Private channel
  IM = "im", // DM
  MPIM = "mpim" // Multi-person DM
}