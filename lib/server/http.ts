import "server-only";
import { NextResponse } from "next/server";
import { ConfigError } from "./env";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function errorJson(message: string, status: number) {
  return json({ error: message }, status);
}

// Reads a small JSON body. Returns null for invalid JSON or oversized bodies.
export async function readJson(req: Request, maxBytes = 8_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Maps unexpected failures to honest messages. Details go to the server log only.
export function failure(err: unknown, what: string) {
  if (err instanceof ConfigError) {
    console.error(`[config] ${err.message}`);
    return errorJson(`${what} is not available because this demo is not fully connected yet. Nothing was saved or charged.`, 503);
  }
  console.error(err);
  return errorJson(`${what} failed because of a server problem. Nothing was saved or charged. Please try again.`, 500);
}
