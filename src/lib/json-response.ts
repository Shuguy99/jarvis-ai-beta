/**
 * JSON Response helper — replaces NextResponse.json for Vite + Hono migration.
 *
 * Usage:  import { json } from "@/lib/json-response";
 *         return json({ error: "Not found" }, 404);
 */
export function json(
  data: unknown,
  statusOrInit?: number | { status?: number; headers?: Record<string, string> },
  extraHeaders?: Record<string, string>,
): Response {
  let status = 200;
  let headers: Record<string, string> = { "Content-Type": "application/json" };

  if (typeof statusOrInit === "number") {
    status = statusOrInit;
  } else if (statusOrInit && typeof statusOrInit === "object") {
    if (statusOrInit.status) status = statusOrInit.status;
    if (statusOrInit.headers) headers = { ...headers, ...statusOrInit.headers };
  }

  if (extraHeaders) headers = { ...headers, ...extraHeaders };

  return new Response(JSON.stringify(data), { status, headers });
}