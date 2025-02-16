
import { z } from "zod";
import { NillionIntegrationConfigSchema, NillionV1DataCreateResponseSchema } from "./schemas";

export type NillionIntegrationConfig = z.infer<typeof NillionIntegrationConfigSchema>

// TODO: Move this error response type to a shared location for other endpoint to use
export type ErrorResponse = {
  status: "error";
  errorCode: string;
  errorMessage?: string;
  errorUserMessage?: string;
};

export type SaveDataV1ErrorResponse = ErrorResponse

export type NillionServiceSaveDataArgs = {
  nillionSchemaId: string,
  data: Record<string, unknown>
}

export type NillionV1DataCreateRequestPayload = {
  schema: string,
  data: object[]
}

export type NillionV1DataCreateResponse = z.infer<typeof NillionV1DataCreateResponseSchema>
