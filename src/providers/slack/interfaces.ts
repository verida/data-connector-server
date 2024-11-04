import { BaseHandlerConfig, BaseProviderConfig } from "../../interfaces";

export interface SlackHandlerConfig extends BaseHandlerConfig {
  // Max batch size to cover all chat groups
  // Slack recommends no more than 200, although max value 1000
  // See slack documentation: https://api.slack.com/methods/conversations.list
  maxBatchSize: number  
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