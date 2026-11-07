import type {
  DecodedInstruction,
  Report,
  RiskFlag,
  RiskLevel,
  SimulationResult,
} from "./types";
import { U64_MAX } from "./programs";

/**
 * Deterministic risk rules. The SCORE AND FLAGS COME FROM HERE, never from the
 * LLM — so the model can explain findings but can't invent a "safe" verdict.
 *
 * Each rule adds points. Higher = riskier. Thresholds map to low/med/high.
 */

const WEIGHTS = { danger: 45, warning: 20, info: 0 };

export function assess(
  instructions: DecodedInstruction[],
  sim: SimulationResult,
  opts: { flaggedAddresses?: Set<string> } = {}
): Pick<Report, "flags" | "score" | "level"> {
  const flags: RiskFlag[] = [];
  const add = (f: RiskFlag) => flags.push(f);

  // 1. Unlimited (or any) token approval granting a delegate spend rights.
  for (const d of sim.delegateChanges) {
    if (d.delegateAfter && d.delegateAfter !== d.delegateBefore) {
      const unlimited = BigInt(d.delegatedAmountAfter) >= U64_MAX;
      add({
        id: `approve-${d.tokenAccount}`,
        severity: "danger",
        title: unlimited ? "Grants UNLIMITED spending of your tokens" : "Grants spending of your tokens",
        detail: `After signing, ${shorten(d.delegateAfter)} can move ${
          unlimited ? "all" : d.delegatedAmountAfter
        } tokens out of your account ${shorten(d.tokenAccount)} without asking again.`,
      });
    }
  }

  // 2. Ownership handover of a token account.
  for (const o of sim.ownerChanges) {
    add({
      id: `owner-${o.tokenAccount}`,
      severity: "danger",
      title: "Hands your token account to someone else",
      detail: `Ownership of ${shorten(o.tokenAccount)} changes from you to ${shorten(o.after)}.`,
    });
  }

  // 3. SetAuthority seen in the decoded instructions (belt-and-suspenders).
  for (const ix of instructions) {
    if (ix.type === "SetAuthority") {
      add({
        id: `setauth-${ix.index}`,
        severity: "danger",
        title: "Changes who controls an account",
        detail: ix.summary,
      });
    }
  }

  // 4. Calls to programs the tool can't read.
  for (const ix of instructions) {
    if (!ix.known && ix.type === "unknown") {
      add({
        id: `unknown-${ix.index}`,
        severity: "warning",
        title: "Calls a program this tool can't read",
        detail: `Instruction ${ix.index + 1} calls ${shorten(ix.programId)}. Unreadable doesn't mean malicious, but you're trusting it blindly.`,
      });
    }
  }

  // 5. Known-bad address from the on-chain scam registry.
  if (opts.flaggedAddresses?.size) {
    for (const ix of instructions) {
      for (const acc of [ix.programId, ...ix.accounts]) {
        if (opts.flaggedAddresses.has(acc)) {
          add({
            id: `flagged-${acc}`,
            severity: "danger",
            title: "Touches an address on the community blocklist",
            detail: `${shorten(acc)} has been flagged in the on-chain scam registry.`,
          });
        }
      }
    }
  }

  // 6. Simulation itself failed — can't vouch for anything.
  if (!sim.ok) {
    add({
      id: "sim-failed",
      severity: "warning",
      title: "Transaction failed to simulate",
      detail: `The dry run errored (${sim.error}). Be cautious: the tool couldn't verify what it does.`,
    });
  }

  const score = Math.min(
    100,
    flags.reduce((sum, f) => sum + WEIGHTS[f.severity], 0)
  );
  const level: RiskLevel = score >= 45 ? "high" : score >= 20 ? "medium" : "low";

  return { flags, score, level };
}

function shorten(a: string) {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
