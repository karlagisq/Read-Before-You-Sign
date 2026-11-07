/** One wallet's snapshot, the same shape whether it came from Helius or demo data. */

export interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  /** Human amount (already divided by 10^decimals), as a string to keep precision. */
  amount: string;
  decimals: number;
  usd: number | null;
  image: string | null;
}

export interface TransferItem {
  signature: string;
  time: number; // unix seconds
  type: string; // Helius type, e.g. "SWAP", "TRANSFER"
  description: string;
  /** Net change for THIS wallet, e.g. [{ symbol: "SOL", amount: "-0.5" }] */
  changes: { symbol: string; amount: string }[];
}

export interface Portfolio {
  address: string;
  cluster: "mainnet" | "devnet";
  source: "helius" | "demo";
  sol: { amount: string; usd: number | null };
  tokens: TokenHolding[];
  transfers: TransferItem[];
  totalUsd: number | null;
  fetchedAt: number;
}
