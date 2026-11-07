import type { NextRequest } from "next/server";

/**
 * Websites you visit must not be able to drive this app's API (spend your
 * RPC / Helius / Anthropic credits, or probe your wallet). Browsers always
 * send Origin on cross-site requests, so allow only: no Origin (CLI, curl),
 * this app itself, and browser extensions. Requiring JSON also forces a CORS
 * preflight, which these routes never approve.
 */
export function allowedCaller(req: NextRequest): boolean {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (origin.startsWith("chrome-extension://")) return true;
  return origin === req.nextUrl.origin;
}
