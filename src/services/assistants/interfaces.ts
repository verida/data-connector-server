import { PromptSearchLLMResponse, PromptSearchType } from "../tools/promptSearch"

export interface PromptSearchServiceDataTypeEmails extends PromptSearchServiceDataType {
    attachmentLength?: number
}

export interface PromptSearchServiceDataType {
    limit?: number
    maxLength?: number
    outputType?: string
    // filter?: object -- @todo support filters
}

export interface PromptSearchServiceDataTypes {
    emails?: PromptSearchServiceDataTypeEmails,
    chatMessages?: PromptSearchServiceDataType,
    favorites?: PromptSearchServiceDataType,
    following?: PromptSearchServiceDataType,
    files?: PromptSearchServiceDataType,
    calendarEvents?: PromptSearchServiceDataType
}

export interface PromptSearchServiceConfig {
    dataTypes?: PromptSearchServiceDataTypes
    promptSearchConfig?: PromptSearchLLMResponse
    jsonFormat?: boolean
}