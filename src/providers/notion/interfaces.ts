import { BaseHandlerConfig, BaseProviderConfig } from "../../../src/interfaces";

export interface NotionProviderConfig extends BaseProviderConfig {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
}

export interface NotionHandlerConfig extends BaseHandlerConfig {
    batchSize: number
}