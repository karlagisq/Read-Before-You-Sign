import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { parseTransaction, decodeInstructions, accountKeys } from "@/lib/decode";
import { simulate } from "@/lib/simulate";
import { assess } from "@/lib/risk";
import { loadFlaggedAddresses } from "@/lib/registry";
import { template, llm } from "@/lib/explain";
import type { Report } from "@/lib/types";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export async function POST(req: NextRequest) {
  try {
    const { transaction } = await req.json();
    if (typeof transaction !== "string" || !transaction.trim()) {
      return NextResponse.json({ error: "Provide a base64 transaction." }, { status: 400 });
    }

    const tx = parseTransaction(transaction);
    const instructions = decodeInstructions(tx);
    const feePayer = accountKeys(tx)[0] ?? "";

    const connection = new Connection(RPC, "confirmed");
    const simulation = await simulate(connection, tx);

    // Community blocklist from the on-chain scam-registry (empty if
    // REGISTRY_PROGRAM_ID isn't set or the registry can't be reached).
    const flaggedAddresses = await loadFlaggedAddresses(connection);
    const { flags, score, level } = assess(instructions, simulation, { flaggedAddresses });

    const partial = { feePayer, instructions, simulation, flags, score, level };

    let explanation = template(partial);
    let explanationSource: Report["explanationSource"] = "template";
    const key = process.env.ANTHROPIC_API_KEY;
    if (key) {
      try {
        const text = await llm(
          { level, score, flags, balanceChanges: simulation.balanceChanges },
          key
        );
        if (text) {
          explanation = text;
          explanationSource = "llm";
        }
      } catch {
        // fall back to template silently
      }
    }

    const report: Report = { ...partial, explanation, explanationSource };
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse that transaction." },
      { status: 400 }
    );
  }
}
