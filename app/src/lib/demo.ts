/**
 * DEMO DATA, clearly labeled in the UI. The wallet and the "DEMOCAT" mint are
 * randomly generated addresses that belong to nobody. USDC is the real USDC
 * mint so the route looks realistic. Lets the app be demoed without an API
 * key or real SOL.
 */
import type { Portfolio } from "./portfolio";

export const DEMO_WALLET = "FjKcs6g3To5QSrqrBumsF68NB6yiRLMCupp8GD4Xyzju";
export const DEMO_MEMECOIN = {
  mint: "EE1V1Gouu8N1a98DroeNVhUPXjNhzNWaRfzPZ3zc6XMX",
  symbol: "DEMOCAT",
  name: "Demo Cat (sample memecoin)",
};
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function demoPortfolio(): Portfolio {
  const now = Math.floor(Date.now() / 1000);
  return {
    address: DEMO_WALLET,
    cluster: "mainnet",
    source: "demo",
    sol: { amount: "12.4", usd: 2108.0 },
    tokens: [
      { mint: USDC_MINT, symbol: "USDC", name: "USD Coin", amount: "850.25", decimals: 6, usd: 850.25, image: null },
      { ...DEMO_MEMECOIN, amount: "1520000", decimals: 6, usd: 41.04, image: null },
    ],
    transfers: [
      { signature: "demo-1", time: now - 3600, type: "SWAP", description: "Swapped 1 SOL for 170 USDC on Jupiter", changes: [{ symbol: "SOL", amount: "-1" }, { symbol: "USDC", amount: "+170" }] },
      { signature: "demo-2", time: now - 86400, type: "SWAP", description: "Swapped 0.25 SOL for 1,520,000 DEMOCAT", changes: [{ symbol: "SOL", amount: "-0.25" }, { symbol: "DEMOCAT", amount: "+1520000" }] },
      { signature: "demo-3", time: now - 3 * 86400, type: "TRANSFER", description: "Received 10 SOL from an exchange withdrawal", changes: [{ symbol: "SOL", amount: "+10" }] },
    ],
    totalUsd: 2999.29,
    fetchedAt: Date.now(),
  };
}
