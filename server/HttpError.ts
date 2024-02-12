export class HttpError extends Error {
  constructor(
    public readonly status: number = 500,
    public readonly code: string = "internal_server_error",
    message: string = "Internal Server Error",
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
