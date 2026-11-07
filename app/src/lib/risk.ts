import type {
  DecodedInstruction,
  Report,
  RiskFlag,
  RiskLevel,
  SimulationResult,
} from "./types";
import { U64_MAX } from "./programs";
import { fmtPct } from "./swaps";

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

  // 1b. Approve seen in the decoded instructions. Catches approvals even when
  // the simulation can't run (e.g. accounts that don't exist on this cluster).
  // Skipped when the simulation diff above already flagged the same account.
  for (const ix of instructions) {
    if (ix.type !== "Approve") continue;
    const acct = ix.details.tokenAccount;
    if (flags.some((f) => f.id === `approve-${acct}`)) continue;
    const unlimited = ix.details.amount === "UNLIMITED";
    add({
      id: `approve-${acct}`,
      severity: "danger",
      title: unlimited ? "Grants UNLIMITED spending of your tokens" : "Grants spending of your tokens",
      detail: `Instruction ${ix.index + 1} lets ${shorten(ix.details.delegate)} move ${
        unlimited ? "all" : ix.details.amount
      } tokens out of ${shorten(acct)} without asking again.`,
    });
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
        if (opts.flaggedAddresses.has(acc) && !flags.some((f) => f.id === `flagged-${acc}`)) {
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

  // 7. Sandwich-attack exposure on swaps. A sandwich bot can take up to your
  // slippage tolerance, so loose slippage = money handed to bots. We can't see
  // or stop the bot (it acts after you sign); we show your maximum exposure.
  for (const ix of instructions) {
    if (ix.type !== "Swap") continue;
    const d = ix.details;
    const n = ix.index + 1;
    const exactIn = d.mode === "exact-in";
    const unlimited = exactIn ? d.limit === "0" : d.limit === "UNLIMITED";
    if (unlimited) {
      add({
        id: `sandwich-${ix.index}`,
        severity: "danger",
        title: "Swap has no price protection (easy sandwich target)",
        detail: exactIn
          ? `Instruction ${n} accepts a minimum of 0 tokens back. A sandwich bot could take nearly everything you're trading.`
          : `Instruction ${n} will pay any amount in. A sandwich bot could make you pay far more than the real price.`,
      });
      continue;
    }
    if (!d.slippageBps) continue;
    const bps = Number(d.slippageBps);
    const exposure = exactIn
      ? `you'd accept as little as ${d.limit} tokens back instead of the quoted ${d.quoted}`
      : `you'd pay up to ${d.limit} tokens instead of the quoted ${d.quoted}`;
    if (bps > 100) {
      add({
        id: `sandwich-${ix.index}`,
        severity: bps >= 500 ? "danger" : "warning",
        title: `High swap slippage (${fmtPct(bps)}) invites sandwich attacks`,
        detail: `Instruction ${n}: bots can push your price up to ${fmtPct(bps)} worse and you'd still sign off on it — ${exposure}. Lower slippage (≤1%) or use an MEV-protected send.`,
      });
    } else {
      add({
        id: `sandwich-${ix.index}`,
        severity: "info",
        title: `Swap slippage is tight (${fmtPct(bps)})`,
        detail: `Instruction ${n}: the most a sandwich bot could take is ${fmtPct(bps)} — ${exposure}.`,
      });
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
