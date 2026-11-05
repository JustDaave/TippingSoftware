import "server-only";
import { createHash } from "node:crypto";
import { db } from "./supabase";
import { rateLimitSalt } from "./env";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

// Returns true when the request is allowed. Keys are hashed so raw IPs are never stored.
export async function allowRequest(
  req: Request,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const hash = createHash("sha256").update(`${rateLimitSalt()}:${clientIp(req)}`).digest("hex").slice(0, 32);
  const { data, error } = await db().rpc("consume_rate_limit", {
    p_bucket: `${action}:${hash}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  return data === true;
}
