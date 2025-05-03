import { BaseHandlerConfig, BaseProviderConfig } from "../../../src/interfaces";

export interface GithubProviderConfig extends BaseProviderConfig {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
}

export interface GithubHandlerConfig extends BaseHandlerConfig {
    batchSize: number
}