import { BaseHandlerConfig, BaseProviderConfig } from "../../../src/interfaces";

export interface SpotifyProviderConfig extends BaseProviderConfig {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
}

export interface SpotifyHandlerConfig extends BaseHandlerConfig {
    batchSize: number
}