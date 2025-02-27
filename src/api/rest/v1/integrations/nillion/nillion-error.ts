import { TechnicalError } from "../../../../../errors/technical-error";

export class NillionError extends TechnicalError {
  constructor(
    message = "Nillion Error",
    userMessage?: string,
  ) {
    super("NillionError", message, userMessage);
  }
}
