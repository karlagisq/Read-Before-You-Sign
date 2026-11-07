/**
 * Helius = the "eyes": parsed Solana data so we don't decode raw accounts.
 * Server-side only (the API key never reaches the browser).
 *
 * Two calls:
 *   - DAS getAssetsByOwner (JSON-RPC): SOL + token balances, symbols, USD prices
 *   - Enhanced Transactions (REST): human-readable recent history
 */
import type { Portfolio, TokenHolding, TransferItem } from "./portfolio";

const RPC = { mainnet: "https://mainnet.helius-rpc.com", devnet: "https://devnet.helius-rpc.com" };
const REST = { mainnet: "https://api.helius.xyz", devnet: "https://api-devnet.helius.xyz" };
const LAMPORTS = 1_000_000_000;

function uiAmount(raw: number | string | bigint, decimals: number): string {
  const n = BigInt(typeof raw === "number" ? Math.trunc(raw) : raw);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = (n % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

// ---- response shapes we rely on (only the fields we read) ----
interface DasItem {
  id: string;
  interface?: string;
  content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } };
  token_info?: {
    symbol?: string;
    balance?: number | string;
    decimals?: number;
    price_info?: { price_per_token?: number; total_price?: number };
  };
}
interface DasResult {
  items: DasItem[];
  nativeBalance?: { lamports: number; price_per_sol?: number; total_price?: number };
}
interface EnhancedTx {
  signature: string;
  timestamp: number;
  type?: string;
  description?: string;
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; tokenAmount: number; mint: string; symbol?: string }[];
}

export function normalizeAssets(result: DasResult): Pick<Portfolio, "sol" | "tokens"> {
  const lamports = result.nativeBalance?.lamports ?? 0;
  const sol = { amount: uiAmount(lamports, 9), usd: result.nativeBalance?.total_price ?? null };
  const tokens: TokenHolding[] = result.items
    .filter((i) => i.token_info && Number(i.token_info.balance ?? 0) > 0)
    .map((i) => {
      const t = i.token_info!;
      const decimals = t.decimals ?? 0;
      return {
        mint: i.id,
        symbol: t.symbol || i.content?.metadata?.symbol || i.id.slice(0, 4),
        name: i.content?.metadata?.name || "Unknown token",
        amount: uiAmount(t.balance ?? 0, decimals),
        decimals,
        usd: t.price_info?.total_price ?? null,
        image: i.content?.links?.image ?? null,
      };
    })
    .sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  return { sol, tokens };
}

export function normalizeTransfers(owner: string, txs: EnhancedTx[], symbols: Map<string, string>): TransferItem[] {
  return txs.map((tx) => {
    const net = new Map<string, number>();
    for (const n of tx.nativeTransfers ?? []) {
      if (n.toUserAccount === owner) net.set("SOL", (net.get("SOL") ?? 0) + n.amount / LAMPORTS);
      if (n.fromUserAccount === owner) net.set("SOL", (net.get("SOL") ?? 0) - n.amount / LAMPORTS);
    }
    for (const t of tx.tokenTransfers ?? []) {
      const sym = t.symbol || symbols.get(t.mint) || `${t.mint.slice(0, 4)}…`;
      if (t.toUserAccount === owner) net.set(sym, (net.get(sym) ?? 0) + t.tokenAmount);
      if (t.fromUserAccount === owner) net.set(sym, (net.get(sym) ?? 0) - t.tokenAmount);
    }
    return {
      signature: tx.signature,
      time: tx.timestamp,
      type: tx.type ?? "UNKNOWN",
      description: tx.description || (tx.type ?? "Transaction").replace(/_/g, " ").toLowerCase(),
      changes: [...net.entries()]
        .filter(([, v]) => Math.abs(v) > 1e-9)
        .map(([symbol, v]) => ({ symbol, amount: `${v > 0 ? "+" : ""}${+v.toPrecision(6)}` })),
    };
  });
}

export async function fetchPortfolio(address: string, cluster: "mainnet" | "devnet", apiKey: string): Promise<Portfolio> {
  const rpc = `${RPC[cluster]}/?api-key=${encodeURIComponent(apiKey)}`;
  const das = fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "rbys-portfolio",
      method: "getAssetsByOwner",
      params: { ownerAddress: address, page: 1, limit: 100, displayOptions: { showFungible: true, showNativeBalance: true } },
    }),
    signal: AbortSignal.timeout(15000),
  }).then(async (r) => {
    const j = await r.json();
    if (j.error) throw new Error(`Helius: ${j.error.message ?? "request failed"}`);
    return j.result as DasResult;
  });
  const history = fetch(`${REST[cluster]}/v0/addresses/${address}/transactions?api-key=${encodeURIComponent(apiKey)}&limit=10`, {
    signal: AbortSignal.timeout(15000),
  })
    .then(async (r) => (r.ok ? ((await r.json()) as EnhancedTx[]) : []))
    .catch(() => [] as EnhancedTx[]); // history is nice-to-have; balances are not

  const [assets, txs] = await Promise.all([das, history]);
  const { sol, tokens } = normalizeAssets(assets);
  const symbols = new Map(tokens.map((t) => [t.mint, t.symbol]));
  const priced = [sol.usd, ...tokens.map((t) => t.usd)].filter((x): x is number => x != null);
  return {
    address,
    cluster,
    source: "helius",
    sol,
    tokens,
    transfers: normalizeTransfers(address, txs, symbols),
    totalUsd: priced.length ? priced.reduce((a, b) => a + b, 0) : null,
    fetchedAt: Date.now(),
  };
}
