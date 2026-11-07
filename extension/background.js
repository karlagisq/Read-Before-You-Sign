/**
 * Service worker: forwards a transaction to the analyzer API (the app's
 * /api/explain) and returns the report. Settings live in chrome.storage.
 */
const DEFAULTS = { enabled: true, apiUrl: "http://localhost:3000", cluster: "devnet" };

// Wallet Standard passes the chain the site asked for, e.g. "solana:mainnet".
function clusterFromChain(chain) {
  const m = typeof chain === "string" && chain.match(/^solana:(mainnet|devnet|testnet)$/);
  return m ? m[1] : null;
}

async function settings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "rbys-check") return;
  (async () => {
    const s = await settings();
    if (!s.enabled) return sendResponse({ enabled: false });
    const cluster = clusterFromChain(msg.chain) || s.cluster;
    try {
      const res = await fetch(`${s.apiUrl.replace(/\/+$/, "")}/api/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transaction: msg.transaction, cluster }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Analyzer returned ${res.status}`);
      sendResponse({ enabled: true, report: data, cluster });
    } catch (e) {
      const reason =
        e && e.name === "TimeoutError" ? "The analyzer took too long to answer."
        : e instanceof TypeError ? `Can't reach the analyzer at ${s.apiUrl}. Is the app running?`
        : String(e.message || e);
      sendResponse({ enabled: true, error: reason, cluster });
    }
  })();
  return true; // async response
});
