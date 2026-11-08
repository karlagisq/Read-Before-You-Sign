import { JUPITER_V6, RAYDIUM_AMM_V4, U64_MAX } from "./programs";

/**
 * Reads the slippage protection out of DEX swap instructions.
 *
 * Why: a sandwich attacker can only take as much as your slippage tolerance
 * allows. The bot buys before you (pushing the price up), your swap still
 * fills because it's within tolerance, then the bot sells after you. So the
 * slippage written into the transaction IS your maximum sandwich loss, and we
 * can read it before you sign.
 *
 * Supported:
 *   - Jupiter v6 route / shared_accounts_route / exact_out_route /
 *     shared_accounts_exact_out_route. These end with
 *     [amountA u64][amountB u64][slippage_bps u16][platform_fee_bps u8],
 *     so we read them from the END of the data, past the variable-length route plan.
 *   - Raydium AMM v4 swapBaseIn (tag 9) / swapBaseOut (tag 11).
 * TODO: Jupiter route_v2 variants, Raydium CLMM/CPMM, Orca, Meteora.
 */

export interface SwapInfo {
  dex: string;
  mode: "exact-in" | "exact-out";
  /** Slippage in basis points (100 = 1%) when the instruction states it. */
  slippageBps: number | null;
  /** exact-in: tokens you put in. exact-out: tokens you want out. */
  amount: bigint;
  /** exact-in: quoted tokens out. exact-out: quoted tokens in. null if not stated. */
  quoted: bigint | null;
  /** exact-in: minimum you accept out. exact-out: maximum you'll pay in. */
  limit: bigint | null;
}

// Anchor discriminators = sha256("global:<instruction>")[0..8], precomputed so
// this file also runs in the browser extension (no Node crypto).
const JUPITER_IXS: Record<string, "exact-in" | "exact-out"> = {
  e517cb977ae3ad2a: "exact-in", // route
  c1209b3341d69c81: "exact-in", // shared_accounts_route
  d033ef977b2bed5c: "exact-out", // exact_out_route
  b0d169a89a7d453e: "exact-out", // shared_accounts_exact_out_route
};

const TAIL = 8 + 8 + 2 + 1;

export function decodeSwap(programId: string, data: Buffer): SwapInfo | null {
  if (programId === JUPITER_V6) {
    const mode = JUPITER_IXS[data.subarray(0, 8).toString("hex")];
    if (!mode || data.length < 8 + 4 + TAIL) return null;
    const t = data.length - TAIL;
    const amount = data.readBigUInt64LE(t);
    const quoted = data.readBigUInt64LE(t + 8);
    const slippageBps = data.readUInt16LE(t + 16);
    const bps = BigInt(slippageBps);
    const limit = mode === "exact-in" ? (quoted * (10000n - bps)) / 10000n : (quoted * (10000n + bps)) / 10000n;
    return { dex: "Jupiter", mode, slippageBps, amount, quoted, limit };
  }

  if (programId === RAYDIUM_AMM_V4 && data.length >= 17 && (data[0] === 9 || data[0] === 11)) {
    const a = data.readBigUInt64LE(1);
    const b = data.readBigUInt64LE(9);
    // Raydium states only the hard limit, not a quote, so slippage % is unknown.
    return data[0] === 9
      ? { dex: "Raydium", mode: "exact-in", slippageBps: null, amount: a, quoted: null, limit: b }
      : { dex: "Raydium", mode: "exact-out", slippageBps: null, amount: b, quoted: null, limit: a };
  }

  return null;
}

/** True when the swap accepts ANY price: min out of 0, or max in of u64::MAX. */
export function noPriceLimit(s: SwapInfo): boolean {
  if (s.limit === null) return false;
  return s.mode === "exact-in" ? s.limit === 0n : s.limit >= U64_MAX;
}

export const fmtPct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
