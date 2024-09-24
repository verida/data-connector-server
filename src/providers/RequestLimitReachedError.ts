
export default class RequestLimitReachedError extends Error {
    constructor(message?: string) {
        super(message)
        this.name = "RequestLimitReached"
      }
}