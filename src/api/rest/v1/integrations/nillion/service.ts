import { v4 as uuidv4 } from "uuid";
import { nilql } from "@nillion/nilql";

import CONFIG from "../../../../../config"

import { NillionError } from "./nillion-error";
import { NillionIntegrationConfigSchema, NillionV1DataCreateResponseSchema } from "./schemas";
import {
  NillionIntegrationConfig,
  NillionServiceSaveDataArgs,
  NillionV1DataCreateRequestPayload,
} from "./types";

export class Service {
  private config: NillionIntegrationConfig

  constructor() {
    const configValidationResult = NillionIntegrationConfigSchema.safeParse(CONFIG.integrations.nillion)

    if (!configValidationResult.success) {
      // Gracefully log the error without crashing the app
      console.error(configValidationResult.error)
    }

    this.config = configValidationResult.data
  }

  /**
   * Saves data to the Nillion API.
   *
   * @param args - The arguments for saving data
   * @param args.nillionSchemaId - ID of the schema to save data against
   * @param args.data - The data to be saved
   *
   * @throws {Error} When the API call fails or returns errors
   *
   * @returns Resolves when data is saved successfully
   */
  public async saveData({
    nillionSchemaId,
    data
  }: NillionServiceSaveDataArgs) {
    console.log("Saving data to Nillion", { nillionSchemaId })

    if (!this.config) {
      throw new Error("Nillion integration configuration is not set")
    }

    const hosts = this.config.hosts

    const cluster = { nodes: hosts.map(() => ({})) };
    const secretKey = await nilql.SecretKey.generate(cluster, {
      store: true,
    }); // key can be discarded since we will never decrypt

    const encryptedData: Record<string, any> = {}

    for (const key in data) {
        encryptedData[key] = {
            $allot: await nilql.encrypt(secretKey, String(data[key])),
        }
    }

    const slices = nilql.allot({
      _id: uuidv4(),
      ...encryptedData
    });

    // Using Promise.all to propagate any error and stop pending requests
    await Promise.all(hosts.map(async (host, index) => {
      const payload: NillionV1DataCreateRequestPayload = {
        schema: nillionSchemaId,
        data: [slices[index]]
      }

      const url = new URL(`${host.baseUrl}/api/v1/data/create`)

      console.debug("Calling Nillion API /api/v1/data/create")
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${host.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Failed to save data to Nillion: ${response.statusText}`)

        throw new NillionError("Failed to save data to Nillion");
      }

      const rawResponseData = await response.json()

      const responseDataValidationResult = NillionV1DataCreateResponseSchema.safeParse(rawResponseData)

      if (!responseDataValidationResult.success) {
        console.warn("Nillion API response validation failed")

        // The Nillion API response doesn't seem to return any user data
        // So it's safe to console the ZodError. But to remove if it was the case.
        console.error(responseDataValidationResult.error)

        // Not throwing an error. Assuming the data save was successful, but our integration and their response mismatch
        return
      }

      const responseData = responseDataValidationResult.data

      if (responseData.errors && responseData.errors.length > 0) {
        console.warn("Nillion API returned errors")
        for (const error of responseData.errors) {
          console.error(error)
        }

        throw new NillionError("Failed to save data to Nillion");
      }
    }))

    console.log("Data saved to Nillion successfully")
  }
}
