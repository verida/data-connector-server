import { Request, Response } from "express";
import { Service } from "./service";
import { SaveDataV1ErrorResponse } from "./types";
import { NillionIntegrationV1SaveDataRequestBodySchema } from "./schemas";
import { BadRequestError } from "../../../../../errors/bad-request-error";

export class ControllerV1 {
  private service: Service

  constructor() {
    this.service = new Service()
  }

  public async saveData(req: Request, res: Response<void | SaveDataV1ErrorResponse>) {
    try {
      const bodyValidationResult = NillionIntegrationV1SaveDataRequestBodySchema.safeParse(req.body)

      if (!bodyValidationResult.success) {
        console.warn("Nillion integration request body validation failed")
        console.error(bodyValidationResult.error)

        throw new BadRequestError("Invalid request body")
      }

      const { jsonProfile, params } = bodyValidationResult.data

      await this.service.saveData({
        data: jsonProfile,
        nillionSchemaId: params.nillionSchemaId,
      })

      return res.sendStatus(204)
    } catch (error: unknown) {
      if (error instanceof BadRequestError) {
        return res.status(400).send({
          status: "error",
          errorCode: error.code,
          errorMessage: error.message,
          errorUserMessage: error.userMessage,
        });
      }

      // Handle other error types if needed

      // If internal error, log it and return a generic error message with a 500 status
      console.error(error)

      return res.status(500).send({
        status: "error",
        errorCode: "InternalError",
        errorMessage: "Something went wrong",
        errorUserMessage: "Something went wrong",
      });
    }
  }
}
