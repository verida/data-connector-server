export type RestrictedAccessStatus = "allowed" | "denied"

export type GetAccessV1SuccessResponse = {
  status: "success";
  access: RestrictedAccessStatus;
};

// TODO: Move this error response type to a shared location for other
// endpoint to use
export type ErrorResponse = {
  status: "error";
  errorCode: string;
  errorMessage?: string;
  errorUserMessage?: string;
};

export type GetAccessV1ErrorResponse = ErrorResponse & {
  access: RestrictedAccessStatus;
};
