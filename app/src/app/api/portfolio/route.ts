import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { allowedCaller } from "@/lib/apiGuard";
import { fetchPortfolio } from "@/lib/helius";
import { DEMO_WALLET, demoPortfolio } from "@/lib/demo";

/**
 * POST { address: string, demo?: boolean }
 * Read-only: takes a PUBLIC address, never a key. Uses Helius when
 * HELIUS_API_KEY is set; otherwise (or for the demo wallet) returns demo data.
 */
export async function POST(req: NextRequest) {
  if (!allowedCaller(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    const { address, demo } = await req.json();
    if (demo || address === DEMO_WALLET) return NextResponse.json(demoPortfolio());

    let owner: string;
    try {
      owner = new PublicKey(String(address ?? "")).toBase58();
    } catch {
      return NextResponse.json({ error: "That isn't a valid Solana address." }, { status: 400 });
    }

    const key = process.env.HELIUS_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "No HELIUS_API_KEY set, so live wallets can't be read. Add one to app/.env.local, or use the demo wallet." },
        { status: 503 }
      );
    }
    const cluster = process.env.HELIUS_CLUSTER === "devnet" ? "devnet" : "mainnet";
    return NextResponse.json(await fetchPortfolio(owner, cluster, key));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't read that wallet.";
    return NextResponse.json({ error: msg.replace(/api-key=[^&\s]+/g, "api-key=***") }, { status: 502 });
  }
}
