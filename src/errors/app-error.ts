export abstract class AppError extends Error {
  public code: string;
  public userMessage?: string;

  constructor(
    code: string,
    message: string,
    userMessage?: string,
    // options?: ErrorOptions
  ) {
    super(message);
    // TODO: Update tsconfig target to newer version of javascript to use ErrorOptions
    // super(message, options);
    this.code = code;
    this.userMessage = userMessage;
  }
}
