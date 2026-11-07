import { Connection, VersionedMessage, VersionedTransaction } from "@solana/web3.js";
import { parseTransaction, decodeInstructions, accountKeys } from "./decode";
import { simulate } from "./simulate";
import { assess } from "./risk";
import { loadFlaggedAddresses } from "./registry";
import { template, llm } from "./explain";
import type { Report, SimulationResult } from "./types";

/**
 * The whole pipeline, shared by the terminal command (src/cli.ts) and the web
 * route: decode → simulate → registry lookup → deterministic risk → explain.
 */

export interface AnalyzeOptions {
  /** Cluster to simulate on. */
  rpcUrl: string;
  /** Cluster the scam-registry lives on (devnet, where you deployed it). */
  registryRpcUrl?: string;
  anthropicApiKey?: string;
}

/**
 * Accepts a base64 transaction OR a bare base64 message, so it also takes the
 * output of the Solana CLI's `--dump-transaction-message`.
 */
export function parseInput(base64: string): VersionedTransaction {
  try {
    return parseTransaction(base64);
  } catch {
    const message = VersionedMessage.deserialize(Buffer.from(base64.trim(), "base64"));
    return new VersionedTransaction(message);
  }
}

export async function analyze(input: string, opts: AnalyzeOptions): Promise<Report> {
  const tx = parseInput(input);
  const instructions = decodeInstructions(tx);
  const feePayer = accountKeys(tx)[0] ?? "";

  const connection = new Connection(opts.rpcUrl, "confirmed");
  const registryConn =
    opts.registryRpcUrl && opts.registryRpcUrl !== opts.rpcUrl
      ? new Connection(opts.registryRpcUrl, "confirmed")
      : connection;

  const [simulation, flaggedAddresses] = await Promise.all([
    // If the RPC is unreachable, still report everything we decoded statically.
    simulate(connection, tx).catch(
      (e): SimulationResult => ({
        ok: false,
        error: `RPC unreachable: ${e instanceof Error ? e.message : String(e)}`,
        logs: [], unitsConsumed: null, balanceChanges: [], delegateChanges: [], ownerChanges: [],
      })
    ),
    loadFlaggedAddresses(registryConn),
  ]);
  const { flags, score, level } = assess(instructions, simulation, { flaggedAddresses });
  const partial = { feePayer, instructions, simulation, flags, score, level };

  let explanation = template(partial);
  let explanationSource: Report["explanationSource"] = "template";
  if (opts.anthropicApiKey) {
    try {
      const text = await llm({ level, score, flags, balanceChanges: simulation.balanceChanges }, opts.anthropicApiKey);
      if (text) {
        explanation = text;
        explanationSource = "llm";
      }
    } catch {
      // fall back to the template
    }
  }
  return { ...partial, explanation, explanationSource };
}
