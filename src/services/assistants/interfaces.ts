import { PromptSearchLLMResponse, PromptSearchType } from "../tools/promptSearch"

export interface PromptSearchServiceDataTypeEmails extends PromptSearchServiceDataType {
    attachmentLength?: number
}

export interface PromptSearchServiceDataType {
    limit?: number,
    maxLength?: number,
    outputType?: string
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
    maxContextLength?: number
    dataTypes?: PromptSearchServiceDataTypes
    promptSearchConfig?: PromptSearchLLMResponse
}