
export default class TokenExpiredError extends Error {
    constructor(message?: string) {
        super(message)
        this.name = "TokenExpiredError"
      }
}