/**
 * Plain-English "what you can do" guidance, shared by the web app, the
 * extension panel and the CLI. Deterministic: chosen by flag type, never
 * written by the AI, so it can't be talked out of a warning.
 */
import type { RiskFlag } from "./types";

export function adviceFor(flag: Pick<RiskFlag, "id" | "severity" | "title">): string[] {
  const kind = flag.id.split("-")[0];
  switch (kind) {
    case "approve":
      return [
        "Only sign if you started this on a site you trust and expect it to spend tokens for you.",
        "If a site really needs an approval, it should ask for an exact amount, not unlimited.",
        "Already signed one like this? Revoke it in your wallet's security settings or with a revoke tool.",
      ];
    case "owner":
    case "setauth":
      return [
        "Reject. Almost no legitimate site needs to take control of your token account.",
        "If you already signed one, move what's left to a fresh wallet.",
      ];
    case "unknown":
      return [
        "Make sure you're on the real site: type the address yourself or use a bookmark, not a link from a DM or ad.",
        "Look the program up on a Solana explorer. Brand-new or unverified programs are a warning sign.",
        "If you go ahead, try a small amount first.",
      ];
    case "flagged":
      return [
        "Reject this transaction.",
        "Close the site and don't reconnect your wallet to it.",
        "If you signed anything there before, check your wallet for approvals and revoke them.",
      ];
    case "sim":
      return [
        "Don't sign what can't be checked, especially on mainnet.",
        "Wait a moment and try again: the network may be busy. If it keeps failing, ask the site why.",
      ];
    case "sandwich":
      if (flag.severity === "info") {
        return ["Good setting. If the swap fails because the price moved, raise slippage a little, not a lot."];
      }
      if (/no price protection/i.test(flag.title)) {
        return [
          "Reject. A swap with no minimum accepts any price at all.",
          "Redo the swap with slippage set: about 0.5% for big tokens, up to 1% for small ones.",
        ];
      }
      return [
        "Lower slippage before signing: 0.3–0.5% for big tokens like SOL and USDC, up to 1% for smaller ones.",
        "Send it through an MEV-protected route (see “Protect your swaps” below).",
        "Big trade? Split it up or use a limit order so there's no slippage to take.",
      ];
    default:
      return [];
  }
}

export interface ProtectStep {
  title: string;
  detail: string;
}

/** Shown whenever a transaction contains a swap, and on the Trade page. */
export const PROTECT_SWAPS: ProtectStep[] = [
  {
    title: "Keep slippage tight",
    detail: "0.3–0.5% on big, liquid tokens (SOL, USDC). Up to 1% on smaller tokens. A sandwich bot can only take as much as your slippage allows.",
  },
  {
    title: "Send privately (MEV protection)",
    detail: "Bots can't sandwich a trade they can't see early. Use Jupiter's Ultra mode, turn on MEV protection if your wallet offers it, or send through a Jito bundle.",
  },
  {
    title: "Check price impact first",
    detail: "Over about 1% means the pool is thin for your trade size, which is exactly where bots hunt. Trade smaller or pick a deeper pool.",
  },
  {
    title: "Use limit orders for big trades",
    detail: "A limit order fills at your price or not at all, so there's no slippage gap to exploit. Splitting a big swap into smaller ones also helps.",
  },
  {
    title: "Avoid brand-new tokens in their first minutes",
    detail: "Fresh memecoin launches have thin pools and swarms of bots. Wait for liquidity to build up.",
  },
  {
    title: "Read before you sign",
    detail: "This tool shows your slippage and the least you'll get back before you sign. If the numbers look off, reject and redo the trade.",
  },
];

export const PROTECT_DISCLAIMER =
  "These steps reduce your exposure; nothing removes it completely. Sandwiches happen after you sign, so the best defense is not giving bots room or visibility.";
