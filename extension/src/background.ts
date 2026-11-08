/**
 * Service worker with the WHOLE analyzer built in (bundled from app/src/lib by
 * app/scripts/build-extension.mjs). No local server needed.
 *
 * Privacy: a transaction leaves this computer only to the Solana RPC for the
 * dry run, the same thing your wallet does for its own preview. Nothing is
 * logged or stored. Default RPCs are Solana's public endpoints; a custom RPC
 * (e.g. your own Helius URL) is opt-in and needs your permission for that host.
 */
import { Connection } from "@solana/web3.js";
import { analyze } from "../../app/src/lib/analyze";
import { PROTECT_DISCLAIMER, PROTECT_SWAPS } from "../../app/src/lib/guidance";

const CLUSTERS: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
};
// The scam registry deployed for this project (devnet).
const REGISTRY_PROGRAM_ID = "Be5rVJnyzJHtnAQKzim6wDGFFgEigJXb2pA7oZ9HkYcH";
const REGISTRY_RPC = CLUSTERS.devnet;

interface Settings {
  enabled: boolean;
  cluster: "devnet" | "mainnet" | "testnet";
  customRpc: string; // "" = use the public endpoint for the cluster
}
const DEFAULTS: Settings = { enabled: true, cluster: "devnet", customRpc: "" };

async function settings(): Promise<Settings> {
  return { ...DEFAULTS, ...((await chrome.storage.sync.get(DEFAULTS)) as Partial<Settings>) };
}

// Wallet Standard passes the chain the site asked for, e.g. "solana:mainnet".
function clusterFromChain(chain: unknown): Settings["cluster"] | null {
  const m = typeof chain === "string" && chain.match(/^solana:(mainnet|devnet|testnet)$/);
  return m ? (m[1] as Settings["cluster"]) : null;
}

function rpcFor(s: Settings, cluster: Settings["cluster"]): string {
  // A custom RPC is only used for the cluster the user picked it for.
  return s.customRpc && cluster === s.cluster ? s.customRpc : CLUSTERS[cluster];
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "rbys-check") {
    (async () => {
      const s = await settings();
      if (!s.enabled) return sendResponse({ enabled: false });
      const cluster = clusterFromChain(msg.chain) ?? s.cluster;
      try {
        const report = await analyze(String(msg.transaction), {
          rpcUrl: rpcFor(s, cluster),
          registryRpcUrl: REGISTRY_RPC,
          registryProgramId: REGISTRY_PROGRAM_ID,
        });
        const hasSwap = report.instructions.some((i) => i.type === "Swap");
        sendResponse({
          enabled: true,
          cluster,
          report,
          protect: hasSwap ? { steps: PROTECT_SWAPS, disclaimer: PROTECT_DISCLAIMER } : null,
        });
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        sendResponse({
          enabled: true,
          cluster,
          error: /deserializ|Reached end|out of range|RangeError/i.test(m) ? "This doesn't look like a Solana transaction this tool can read." : m,
        });
      }
    })();
    return true;
  }

  if (msg?.type === "rbys-ping") {
    (async () => {
      const s = await settings();
      const started = Date.now();
      try {
        const v = await new Connection(rpcFor(s, s.cluster), "confirmed").getVersion();
        sendResponse({ ok: true, ms: Date.now() - started, version: v["solana-core"], cluster: s.cluster });
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e), cluster: s.cluster });
      }
    })();
    return true;
  }
});
