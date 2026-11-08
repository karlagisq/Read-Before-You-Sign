import { NextRequest, NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";
import { allowedCaller } from "@/lib/apiGuard";

const CLUSTERS: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  mainnet: process.env.MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com",
};
const DEFAULT_RPC = process.env.SOLANA_RPC_URL ?? CLUSTERS.devnet;

/**
 * POST { transaction: base64, cluster?: "devnet" | "mainnet" | "testnet" }
 * Used by the web UI, the browser extension (from its background worker) and curl.
 */
export async function POST(req: NextRequest) {
  if (!allowedCaller(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    const { transaction, cluster } = await req.json();
    if (typeof transaction !== "string" || !transaction.trim()) {
      return NextResponse.json({ error: "Provide a base64 transaction." }, { status: 400 });
    }
    const rpcUrl = typeof cluster === "string" && CLUSTERS[cluster] ? CLUSTERS[cluster] : DEFAULT_RPC;
    const report = await analyze(transaction, {
      rpcUrl,
      registryRpcUrl: process.env.REGISTRY_RPC_URL ?? CLUSTERS.devnet,
      registryProgramId: process.env.REGISTRY_PROGRAM_ID,
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
