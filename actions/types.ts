/**
 * Every server action returns this shape rather than throwing.
 *
 * A thrown error in a server action reaches the client as a generic "an error
 * occurred" in production, which is useless to the person using the app. These
 * results carry a message worth reading, and `useActionState` renders them.
 */
export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export const IDLE: ActionResult | null = null;

export function failure(message: string): ActionResult {
  return { ok: false, message };
}

export function success(message: string): ActionResult {
  return { ok: true, message };
}

/** Turns an unknown thrown value into a message safe to show a user. */
export function messageFor(error: unknown): string {
  if (error instanceof Error) {
    // ValidationError and NotFoundError carry deliberately user-facing text.
    if (error.name === "ValidationError" || error.name === "NotFoundError") {
      return error.message;
    }
    if (/ECONNREFUSED|ENOTFOUND|querySrv|timed out|topology/i.test(error.message)) {
      return "Could not reach the database. Check the connection and try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
