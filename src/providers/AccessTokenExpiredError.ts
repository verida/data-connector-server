
export default class AccessTokenExpiredError extends Error {
    constructor(message?: string) {
        super(message)
        this.name = "AccessTokenExpiredError"
      }
}