import { NextRequest, NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";

const CLUSTERS: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  mainnet: process.env.MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com",
};
const DEFAULT_RPC = process.env.SOLANA_RPC_URL ?? CLUSTERS.devnet;

/**
 * POST { transaction: base64, cluster?: "devnet" | "mainnet" | "testnet" }
 * Used by the web UI, the browser extension (from its background worker) and curl.
 *
 * Websites you visit must not be able to drive your local analyzer. Browsers
 * always send Origin on cross-site POSTs, so allow only: no Origin (CLI,
 * curl), this app itself, and browser extensions. JSON content-type is
 * required, which also forces a CORS preflight that this route never approves.
 */
function allowed(req: NextRequest): boolean {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (origin.startsWith("chrome-extension://")) return true;
  return origin === req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    const { transaction, cluster } = await req.json();
    if (typeof transaction !== "string" || !transaction.trim()) {
      return NextResponse.json({ error: "Provide a base64 transaction." }, { status: 400 });
    }
    const rpcUrl = typeof cluster === "string" && CLUSTERS[cluster] ? CLUSTERS[cluster] : DEFAULT_RPC;
    const report = await analyze(transaction, {
      rpcUrl,
      registryRpcUrl: process.env.REGISTRY_RPC_URL ?? CLUSTERS.devnet,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
    return NextResponse.json({ ...report, cluster: CLUSTERS[cluster] ? cluster : "devnet" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse that transaction." },
      { status: 400 }
    );
  }
}
