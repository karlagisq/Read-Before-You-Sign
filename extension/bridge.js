/**
 * Runs in the extension's ISOLATED world on every page. Receives review
 * requests from inject.js, gets each transaction analyzed (via background.js),
 * and shows the review panel. The panel lives in a closed shadow root and only
 * accepts real user clicks (event.isTrusted), so page scripts can't read it or
 * click "Continue" for you.
 */
(() => {
  const TAG = "__rbys";
  const post = (msg) => window.postMessage({ [TAG]: msg.type, ...msg }, "*");

  window.addEventListener("message", async (e) => {
    if (e.source !== window || !e.data || e.data[TAG] === undefined) return;
    const m = e.data;
    if (m[TAG] === "hello") post({ type: "ready" });
    if (m[TAG] !== "review" || !Array.isArray(m.transactions)) return;

    post({ type: "ack", id: m.id });
    const allow = await reviewRequest(m);
    post({ type: "decision", id: m.id, allow });
  });

  async function analyze(transaction, chain) {
    try {
      return await chrome.runtime.sendMessage({ type: "rbys-check", transaction, chain });
    } catch {
      return { enabled: true, error: "The extension was updated. Refresh this page." };
    }
  }

  function reviewRequest(m) {
    const ui = openPanel(m.origin, m.transactions.length);
    (async () => {
      const results = [];
      for (let i = 0; i < m.transactions.length && !ui.closed; i++) {
        const r = await analyze(m.transactions[i], m.chain);
        if (r && r.enabled === false) return ui.close(); // guard switched off in the popup
        results.push(r);
        if (!ui.closed) ui.render(results, m.transactions.length);
      }
    })();
    return ui.decision; // resolves as soon as the user clicks, even mid-check
  }

  // ---------------------------------------------------------------- panel UI
  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
    background: rgba(3, 6, 16, .62); backdrop-filter: blur(6px);
    font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #eef1ff; }
  .card { width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
    background: #111830; border: 1px solid rgba(148,163,255,.18); border-radius: 24px; padding: 18px;
    box-shadow: 0 40px 100px -30px rgba(0,0,0,.8); }
  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .mark { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center;
    background: linear-gradient(135deg,#5eead4,#38bdf8 45%,#8b5cf6); color: #06101f; font-weight: 900; }
  .brand { font-weight: 700; }
  .origin { color: #8d97c4; font-size: 13px; margin: 2px 0 14px; word-break: break-all; }
  .origin b { color: #eef1ff; font-weight: 600; }
  .tx + .tx { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(148,163,255,.14); }
  .txlabel { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5c668f; font-weight: 700; margin-bottom: 6px; }
  .verdict { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; border: 1px solid; }
  .verdict.high { background: rgba(255,107,129,.12); border-color: rgba(255,107,129,.35); }
  .verdict.medium { background: rgba(251,191,36,.12); border-color: rgba(251,191,36,.35); }
  .verdict.low { background: rgba(52,211,153,.12); border-color: rgba(52,211,153,.35); }
  .verdict.none { background: #0b1124; border-color: rgba(148,163,255,.14); }
  .vi { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; font-weight: 900; }
  .high .vi { background: #ff6b81; color: #2a0610; } .medium .vi { background: #fbbf24; color: #2a1d02; }
  .low .vi { background: #34d399; color: #03251a; } .none .vi { background: rgba(255,255,255,.08); }
  .vt { font-weight: 700; font-size: 16px; } .vs { color: #8d97c4; font-size: 12px; }
  .score { margin-left: auto; text-align: right; font-weight: 800; font-size: 20px; }
  .score span { display: block; font-size: 11px; font-weight: 500; color: #8d97c4; }
  .flag { display: grid; grid-template-columns: 18px 1fr; gap: 8px; margin-top: 8px; padding: 10px 12px;
    background: #0b1124; border: 1px solid rgba(148,163,255,.14); border-radius: 12px; }
  .fm { font-weight: 800; } .danger .fm { color: #ff6b81; } .warning .fm { color: #fbbf24; } .info .fm { color: #7dd3fc; }
  .ft { font-weight: 600; } .fd { color: #8d97c4; font-size: 13px; margin-top: 2px; }
  .explain { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: #0b1124; font-size: 13px; }
  .route { margin-top: 8px; color: #8d97c4; font-size: 12px; }
  .spin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,.15); border-top-color: #5eead4;
    animation: s .8s linear infinite; } @keyframes s { to { transform: rotate(360deg); } }
  .confirm { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; font-size: 13px; color: #c7cdf0; cursor: pointer; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
  button { font: inherit; font-weight: 700; padding: 13px; border-radius: 14px; cursor: pointer; border: 0; }
  .reject { background: linear-gradient(135deg,#5eead4,#38bdf8 45%,#8b5cf6); color: #06101f; }
  .go { background: rgba(255,255,255,.06); color: #eef1ff; border: 1px solid rgba(148,163,255,.28); }
  .go:disabled { opacity: .4; cursor: default; }
  .foot { margin-top: 10px; font-size: 11px; color: #5c668f; text-align: center; }
  `;

  const LEVEL = {
    high: ["!", "High risk", "Don't sign this unless you're sure."],
    medium: ["?", "Worth a look", "Read the warnings before signing."],
    low: ["✓", "Looks okay", "Nothing risky stood out."],
  };
  const MARK = { danger: "✖", warning: "▲", info: "ℹ" };
  const RANK = { low: 0, medium: 1, high: 2 };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function openPanel(origin, count) {
    const host = document.createElement("rbys-review");
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);

    const backdrop = el("div", "backdrop");
    const card = el("div", "card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Read Before You Sign review");
    const head = el("div", "head");
    head.append(el("div", "mark", "✓"), el("div", "brand", "Read Before You Sign"));
    const originLine = el("div", "origin");
    originLine.append(el("b", null, origin), document.createTextNode(` wants your wallet to sign ${count === 1 ? "a transaction" : `${count} transactions`}.`));
    const body = el("div");
    const loading = el("div", "verdict none");
    loading.append(el("div", "spin"), el("div", "vs", "Simulating on Solana…"));
    body.append(loading);

    const confirm = el("label", "confirm");
    const box = document.createElement("input");
    box.type = "checkbox";
    confirm.append(box, el("span", null, "I understand the risk and still want to open my wallet."));
    confirm.style.display = "none";

    const actions = el("div", "actions");
    const reject = el("button", "reject", "Reject");
    const go = el("button", "go", "Continue to wallet");
    go.disabled = true;
    actions.append(reject, go);
    const foot = el("div", "foot", "Score and warnings come from fixed rules, not AI.");
    card.append(head, originLine, body, confirm, actions, foot);
    backdrop.append(card);
    root.append(backdrop);
    (document.body || document.documentElement).append(host);

    let done;
    const decision = new Promise((r) => (done = r));
    let worst = null;
    let finished = false;

    let closed = false;
    const finish = (allow) => {
      if (closed) return;
      closed = true;
      host.remove();
      window.removeEventListener("keydown", onKey, true);
      done(allow);
    };
    const onKey = (e) => {
      if (e.isTrusted && e.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKey, true);
    reject.addEventListener("click", (e) => e.isTrusted && finish(false));
    go.addEventListener("click", (e) => e.isTrusted && !go.disabled && finish(true));
    box.addEventListener("change", (e) => {
      if (e.isTrusted) go.disabled = !box.checked;
    });

    function render(results, total) {
      body.replaceChildren();
      results.forEach((r, i) => {
        const sec = el("div", "tx");
        if (total > 1) sec.append(el("div", "txlabel", `Transaction ${i + 1} of ${total}`));
        if (!r || r.error) {
          const v = el("div", "verdict medium");
          const t = el("div");
          t.append(el("div", "vt", "Couldn't check this"), el("div", "vs", (r && r.error) || "No response from the analyzer."));
          v.append(el("div", "vi", "?"), t);
          sec.append(v);
          worst = worst === "high" ? "high" : "medium";
        } else {
          const rep = r.report;
          const [icon, title, sub] = LEVEL[rep.level];
          const v = el("div", `verdict ${rep.level}`);
          const t = el("div");
          t.append(el("div", "vt", title), el("div", "vs", sub));
          const sc = el("div", "score", String(rep.score));
          sc.append(el("span", null, "/ 100 risk"));
          v.append(el("div", "vi", icon), t, sc);
          sec.append(v);
          for (const f of rep.flags) {
            const fl = el("div", `flag ${f.severity}`);
            const txt = el("div");
            txt.append(el("div", "ft", f.title), el("div", "fd", f.detail));
            fl.append(el("div", "fm", MARK[f.severity] || "•"), txt);
            sec.append(fl);
          }
          if (rep.explanationSource === "llm") sec.append(el("div", "explain", rep.explanation));
          const names = [...new Set(rep.instructions.map((x) => x.programName))].join(" → ");
          sec.append(el("div", "route", `Route: ${names} · simulated on ${r.cluster}`));
          if (worst === null || RANK[rep.level] > RANK[worst]) worst = rep.level;
        }
        body.append(sec);
      });

      finished = results.length === total;
      if (!finished) {
        const more = el("div", "verdict none");
        more.style.marginTop = "12px";
        more.append(el("div", "spin"), el("div", "vs", `Checking ${results.length + 1} of ${total}…`));
        body.append(more);
        return;
      }
      // High risk: require an explicit tick before the wallet can open.
      confirm.style.display = worst === "high" ? "flex" : "none";
      go.disabled = worst === "high" && !box.checked;
    }

    return {
      render,
      close: () => finish(true),
      get closed() {
        return closed;
      },
      get decision() {
        return decision;
      },
    };
  }
})();
