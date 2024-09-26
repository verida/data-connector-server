import { BaseHandlerConfig, BaseProviderConfig } from "../../interfaces";

export interface DiscordHandlerConfig extends BaseHandlerConfig {
  // Maximum number of channels to process
  channelLimit: number;
  // Maximum number of messages to process in a given batch
  messageBatchSize: number;
  // Maximum number of messages to process in a channel
  messagesPerChannelLimit: number;
}

export interface DiscordProviderConfig extends BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  token: string;
  callbackUrl: string;
}

export enum DiscordChatGroupType {
  GUILD_TEXT = "guild_text", // Text channel in a server
  DM = "dm", // Direct message
  GUILD_VOICE = "guild_voice", // Voice channel in a server
  GROUP_DM = "group_dm", // Group direct message
  GUILD_CATEGORY = "guild_category", // Category that contains channels
  GUILD_NEWS = "guild_news", // News channels (for announcements)
  GUILD_STORE = "guild_store", // Store channels (for selling items)
}
