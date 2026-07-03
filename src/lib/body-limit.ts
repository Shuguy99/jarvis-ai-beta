/**
 * Request body size guard — Phase 0.5
 *
 * Usage in any POST handler:
 *   import { enforceBodyLimit, MAX_BODY_BYTES } from "@/lib/body-limit";
 *   const body = await enforceBodyLimit(req, MAX_BODY_BYTES);
 */

export const MAX_BODY_BYTES_CHAT = 512 * 1024;      // 512 KB — chat messages
export const MAX_BODY_BYTES_VISION = 20 * 1024 * 1024; // 20 MB — base64 images
export const MAX_BODY_BYTES_DEFAULT = 1 * 1024 * 1024;  // 1 MB — everything else

/**
 * Reads and size-checks the request body.
 * Throws a NextResponse (to be returned) if the body exceeds `maxBytes`.
 */
export async function enforceBodyLimit(
  req: Request,
  maxBytes: number
): Promise<string> {
  // Check Content-Length header first (cheap)
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > maxBytes) {
    throw new BodyLimitError(maxBytes);
  }

  // Also measure actual body (Content-Length can be spoofed/missing)
  const bodyText = await req.text();
  if (Buffer.byteLength(bodyText, "utf-8") > maxBytes) {
    throw new BodyLimitError(maxBytes);
  }

  return bodyText;
}

export class BodyLimitError extends Error {
  public readonly maxBytes: number;
  constructor(maxBytes: number) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1);
    super(`Request body exceeds ${mb} MB limit`);
    this.name = "BodyLimitError";
    this.maxBytes = maxBytes;
  }
}

/**
 * Helper: parse JSON body with size limit.
 * Returns the parsed object, or throws BodyLimitError.
 */
export async function parseJsonBody<T>(
  req: Request,
  maxBytes: number = MAX_BODY_BYTES_DEFAULT
): Promise<T> {
  const raw = await enforceBodyLimit(req, maxBytes);
  return JSON.parse(raw) as T;
}