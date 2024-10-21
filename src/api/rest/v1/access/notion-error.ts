import { TechnicalError } from "../../../../errors/technical-error";

export class NotionError extends TechnicalError {
  constructor(
    message = "NotionError",
    userMessage?: string,
  ) {
    super("NotionError", message, userMessage);
  }
}
