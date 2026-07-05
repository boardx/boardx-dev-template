export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** SQLite/D1's message when an INSERT hits a UNIQUE index — the atomic-claim
 *  route relies on catching exactly this rather than doing a racy SELECT-then-INSERT. */
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed");
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "internal_error" }, { status: 500 });
}
