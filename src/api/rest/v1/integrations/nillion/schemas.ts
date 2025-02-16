import { z } from "zod";

export const NillionIntegrationConfigSchema = z.object({
  hosts: z.array(z.object({
    baseUrl: z.string().url(),
    bearerToken: z.string(),
  })).min(1),
  schemaIds: z.object({
    founderPersonalityTraitsSurvey: z.string(),
  })
})

export const NillionIntegrationV1SaveDataRequestBodySchema = z.object({
  jsonProfile: z.record(z.unknown()),
  jsonSchemaUrl: z.string().url(),
  params: z.object({
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

const NillionFounderPersonalityTraitsSchema = z.object({
  value: z.number(),
  explanation: z.string()
})

export const NillionFounderPersonalitySurveyDataSchema = z.object({
  occupation: z.string(),
  country: z.string(),
  region: z.string(),
  traits: z.object({
    visionary: NillionFounderPersonalityTraitsSchema,
    resilience: NillionFounderPersonalityTraitsSchema,
    riskTolerance: NillionFounderPersonalityTraitsSchema,
    adaptability: NillionFounderPersonalityTraitsSchema,
    charisma: NillionFounderPersonalityTraitsSchema.optional(),
    confidence: NillionFounderPersonalityTraitsSchema.optional(),
    drive: NillionFounderPersonalityTraitsSchema,
    communicationSkills: NillionFounderPersonalityTraitsSchema.optional(),
    empathy: NillionFounderPersonalityTraitsSchema.optional(),
    decisionMaking: NillionFounderPersonalityTraitsSchema
  })
})
