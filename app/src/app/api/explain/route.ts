import { NextRequest, NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export async function POST(req: NextRequest) {
  try {
    const { transaction } = await req.json();
    if (typeof transaction !== "string" || !transaction.trim()) {
      return NextResponse.json({ error: "Provide a base64 transaction." }, { status: 400 });
    }
    const report = await analyze(transaction, {
      rpcUrl: RPC,
      registryRpcUrl: process.env.REGISTRY_RPC_URL ?? "https://api.devnet.solana.com",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse that transaction." },
      { status: 400 }
    );
  }
}
