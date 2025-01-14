
import { z } from "zod";
import { NillionV1DataCreateResponseSchema } from "./schemas";

// TODO: Move this error response type to a shared location for other endpoint to use
export type ErrorResponse = {
  status: "error";
  errorCode: string;
  errorMessage?: string;
  errorUserMessage?: string;
};

export type SaveDataV1ErrorResponse = ErrorResponse

export type NillionServiceSaveDataArgs = {
  nillionDbBaseUrl: string,
  nillionDbBearerToken: string,
  nillionSchemaId: string,
  data: Record<string, unknown>
}

export type NillionV1DataCreateRequestPayload = {
  schema: string,
  data: Record<string, unknown>[]
}

export type NillionV1DataCreateResponse = z.infer<typeof NillionV1DataCreateResponseSchema>
