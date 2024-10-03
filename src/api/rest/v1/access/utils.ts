import { Request } from "express";
import { isValidVeridaDid } from "../../../../utils";
import { BadRequestError } from "../../../../errors/bad-request-error";

/**
 * Extracts the DID from the request parameters.
 *
 * @param req The request object.
 * @returns The DID.
 * @throws {BadRequestError} If the DID is invalid.
 */
export function extractDidFromRequestParams(req: Request): string {
  const did = req.params.did;

  const isValid = isValidVeridaDid(did);
  if (isValid) {
    return did;
  }

  throw new BadRequestError("Invalid DID parameter in request");
}
