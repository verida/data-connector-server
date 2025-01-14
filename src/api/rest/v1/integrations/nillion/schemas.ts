import { z } from "zod";

export const NillionIntegrationV1SaveDataRequestBodySchema = z.object({
  jsonProfile: z.record(z.unknown()),
  jsonSchema: z.string(),
  integrationParams: z.object({
    nillionDbEndpoint: z.string().url(),
    nillionDbBearerToken: z.string(),
    nillionSchemaId: z.string(),
  })
})

export const NillionV1DataCreateResponseSchema = z.object({
  ts: z.string().optional(),
  errors: z.array(z.string()).optional(),
  data: z.object({
    created: z.array(z.any()).optional(),
    errors: z.array(z.any()).optional(),
  }).optional(),
});
