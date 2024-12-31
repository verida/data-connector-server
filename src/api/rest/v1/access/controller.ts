import { Request, Response } from "express";
import { extractDidFromRequestParams } from "./utils"
import { Service } from "./service"
import { BadRequestError } from "../../../../errors/bad-request-error"
import { GetAccessV1SuccessResponse, GetAccessV1ErrorResponse } from "./types";

export class ControllerV1 {
  private service: Service

  constructor() {
    this.service = new Service()
  }

  async getAccess(req: Request, res: Response<GetAccessV1SuccessResponse | GetAccessV1ErrorResponse>) {
    try {
      const did = extractDidFromRequestParams(req)

      const accessRecord = await this.service.getAccessRecord(did)

      if (accessRecord) {
        this.service.updateLatestAccess(accessRecord).catch(console.error)
      }

      return res.status(200).send({
        status: "success",
        access: accessRecord?.access ? "allowed" : "denied",
      })
    } catch (error: unknown) {
      if (error instanceof BadRequestError) {
        return res.status(400).send({
          access: "denied",
          status: "error",
          errorCode: error.code,
          errorMessage: error.message,
          errorUserMessage: error.userMessage,
        });
      }

      // Handle other error types if needed

      return res.status(500).send({
        access: "denied",
        status: "error",
        errorCode: "InternalError",
        errorMessage: "Something went wrong",
        errorUserMessage: "Something went wrong",
      });
    }
  }
}
