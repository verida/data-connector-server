import { v4 as uuidv4 } from "uuid";

import { NillionError } from "./nillion-error";
import { NillionV1DataCreateResponseSchema } from "./schemas";
import {
  NillionServiceSaveDataArgs,
  NillionV1DataCreateRequestPayload,
} from "./types";

export class Service {

  /**
   * Saves data to the Nillion API.
   *
   * @param args - The arguments for saving data
   * @param args.nillionBaseUrl - Base URL of the Nillion API
   * @param args.nillionBearerToken - Bearer token for authentication
   * @param args.nillionSchemaId - ID of the schema to save data against
   * @param args.data - The data to be saved
   *
   * @throws {Error} When the API call fails or returns errors
   *
   * @returns Resolves when data is saved successfully
   */
  public async saveData({
    nillionBaseUrl,
    nillionBearerToken,
    nillionSchemaId,
    data
  }: NillionServiceSaveDataArgs) {
    console.log("Saving data to Nillion", { nillionBaseUrl, nillionSchemaId })

    const payload: NillionV1DataCreateRequestPayload = {
      schema: nillionSchemaId,
      data: [{
        _id: uuidv4(),
        ...data
      }]
    }

    const url = new URL(`${nillionBaseUrl}/api/v1/data/create`)

    console.debug("Calling Nillion API /api/v1/data/create")
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${nillionBearerToken}`,
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

    console.log("Data saved to Nillion successfully")
  }
}
