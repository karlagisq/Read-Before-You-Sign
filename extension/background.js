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

// Pending transactions are sensitive (a bot that sees your swap early can
// sandwich it), so the extension only ever sends them to an analyzer on this
// computer. Changing the setting to a remote URL is refused.
function isLocal(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
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
    if (!isLocal(s.apiUrl)) {
      return sendResponse({ enabled: true, error: "Analyzer URL must be on this computer (localhost). Fix it in the extension settings.", cluster });
    }
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
