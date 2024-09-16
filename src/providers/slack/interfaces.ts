import { BaseProviderConfig } from "../../interfaces";

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