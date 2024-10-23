import { FunctionalError } from "./functional-error";

export class BadRequestError extends FunctionalError {
  constructor(
    message = "Bad request",
    userMessage?: string,
    // options?: ErrorOptions
  ) {
    // TODO: Update tsconfig target to newer version of javascript to use ErrorOptions
    // super("BadRequestError", message, userMessage, options);
    super("BadRequestError", message, userMessage);
  }
}
