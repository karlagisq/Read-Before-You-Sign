/**
 * Runs in the PAGE's JavaScript world (MAIN) at document_start, before the
 * site's own code. It wraps the wallet's signing methods so every sign
 * request is first sent to the extension for review. It never changes a
 * transaction: it only pauses the request until you choose Continue or Reject.
 *
 * Covers:
 *   - Wallet Standard wallets (how Phantom/Solflare/Backpack talk to
 *     wallet-adapter sites): solana:signTransaction, solana:signAndSendTransaction
 *   - Injected providers: window.solana, window.phantom.solana,
 *     window.solflare, window.backpack (signTransaction, signAllTransactions,
 *     signAndSendTransaction, signAndSendAllTransactions)
 *
 * Limitation (say this in the write-up): code in the page world can be
 * tampered with by a site that targets this extension specifically. This
 * guards against everyday risky and phishing transactions, not an attacker
 * who has engineered around the guard.
 */
(() => {
  if (window.__rbysGuard) return;
  Object.defineProperty(window, "__rbysGuard", { value: true });

  const TAG = "__rbys";
  const postMessage = window.postMessage.bind(window);
  let bridgeReady = false;
  const waiting = new Map(); // id -> { ack, resolve }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data[TAG] === undefined) return;
    const m = e.data;
    if (m[TAG] === "ready") bridgeReady = true;
    const w = waiting.get(m.id);
    if (!w) return;
    if (m[TAG] === "ack") w.ack();
    if (m[TAG] === "decision") {
      waiting.delete(m.id);
      w.resolve(m.allow === true);
    }
  });
  postMessage({ [TAG]: "hello" }, "*"); // bridge answers "ready"

  // ---------- helpers ----------
  function toBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function serialize(tx) {
    if (tx instanceof Uint8Array) return tx;
    if (tx && typeof tx.serialize === "function") {
      // Legacy Transaction needs these flags to serialize unsigned; VersionedTransaction ignores them.
      return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    }
    throw new Error("unrecognized transaction");
  }

  function rejection() {
    const e = new Error("User rejected the request (Read Before You Sign)");
    e.code = 4001;
    return e;
  }

  /** Asks the extension to review; resolves when the user decides. */
  function review(txs, chain, method) {
    let transactions;
    try {
      transactions = txs.map((t) => toBase64(serialize(t)));
    } catch {
      return Promise.resolve(true); // can't read it: let the wallet handle it as usual
    }
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      let acked = false;
      waiting.set(id, { ack: () => (acked = true), resolve });
      postMessage({ [TAG]: "review", id, transactions, chain: chain || null, method, origin: location.origin }, "*");
      // If the extension isn't listening (disabled/reloaded), don't hang the site.
      setTimeout(() => {
        if (!acked) {
          waiting.delete(id);
          resolve(true);
        }
      }, bridgeReady ? 3000 : 1500);
    });
  }

  async function gate(txs, chain, method) {
    if (!(await review(txs, chain, method))) throw rejection();
  }

  // ---------- injected providers ----------
  const wrappedProviders = new WeakSet();
  const LEGACY_METHODS = {
    signTransaction: false,
    signAllTransactions: true,
    signAndSendTransaction: false,
    signAndSendAllTransactions: true,
  };

  function wrapProvider(p) {
    if (!p || typeof p !== "object" || wrappedProviders.has(p)) return;
    wrappedProviders.add(p);
    for (const [name, many] of Object.entries(LEGACY_METHODS)) {
      const orig = p[name];
      if (typeof orig !== "function") continue;
      const wrapped = async function (...args) {
        await gate(many ? Array.from(args[0] || []) : [args[0]], null, name);
        return orig.apply(p, args);
      };
      try {
        Object.defineProperty(p, name, { value: wrapped, configurable: true, writable: true });
      } catch {
        /* frozen provider: skip */
      }
    }
  }

  const GLOBALS = [["solana"], ["phantom", "solana"], ["solflare"], ["backpack"]];
  function scanGlobals() {
    for (const path of GLOBALS) {
      let v = window;
      for (const k of path) v = v && v[k];
      if (v) wrapProvider(v);
    }
  }
  // Catch wallets assigned later (wallet extensions inject at different times).
  for (const name of ["solana", "solflare", "backpack"]) {
    if (name in window) continue;
    let value;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: (v) => {
          value = v;
          wrapProvider(v);
        },
      });
    } catch {
      /* already defined non-configurably */
    }
  }
  scanGlobals();
  let scans = 0;
  const timer = setInterval(() => {
    scanGlobals();
    if (++scans > 60) clearInterval(timer); // ~30s at startup
  }, 500);
  window.addEventListener("focus", scanGlobals);

  // ---------- Wallet Standard ----------
  const wrappedWallets = new WeakMap();
  const wrappedFeatures = new WeakMap();

  function wrapFeatures(f) {
    if (!f || typeof f !== "object") return f;
    if (wrappedFeatures.has(f)) return wrappedFeatures.get(f);
    const out = { ...f };
    const st = f["solana:signTransaction"];
    if (st && typeof st.signTransaction === "function") {
      out["solana:signTransaction"] = {
        ...st,
        signTransaction: async (...inputs) => {
          await gate(inputs.map((i) => i.transaction), inputs[0] && inputs[0].chain, "signTransaction");
          return st.signTransaction(...inputs);
        },
      };
    }
    const sas = f["solana:signAndSendTransaction"];
    if (sas && typeof sas.signAndSendTransaction === "function") {
      out["solana:signAndSendTransaction"] = {
        ...sas,
        signAndSendTransaction: async (...inputs) => {
          await gate(inputs.map((i) => i.transaction), inputs[0] && inputs[0].chain, "signAndSendTransaction");
          return sas.signAndSendTransaction(...inputs);
        },
      };
    }
    wrappedFeatures.set(f, out);
    return out;
  }

  function wrapWallet(w) {
    if (!w || typeof w !== "object") return w;
    if (wrappedWallets.has(w)) return wrappedWallets.get(w);
    const proxy = new Proxy(w, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target);
        if (prop === "features") return wrapFeatures(v);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    wrappedWallets.set(w, proxy);
    return proxy;
  }

  // Wallets and apps find each other through two window events. We rewrap
  // both directions so whichever happens first, the app receives our wrapper.
  const dispatch = EventTarget.prototype.dispatchEvent;
  window.dispatchEvent = function (event) {
    try {
      if (event && event.type === "wallet-standard:register-wallet" && typeof event.detail === "function") {
        const cb = event.detail;
        event = new CustomEvent(event.type, {
          detail: (api) => cb({ ...api, register: (...ws) => api.register(...ws.map(wrapWallet)) }),
        });
      } else if (event && event.type === "wallet-standard:app-ready" && event.detail && typeof event.detail.register === "function") {
        const api = event.detail;
        event = new CustomEvent(event.type, {
          detail: { ...api, register: (...ws) => api.register(...ws.map(wrapWallet)) },
        });
      }
    } catch {
      /* never break the page */
    }
    return dispatch.call(this, event);
  };
})();
