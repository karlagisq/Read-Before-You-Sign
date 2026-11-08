/**
 * Runs in the extension's ISOLATED world on every page. Receives review
 * requests from inject.js, has each transaction analyzed by the built-in
 * analyzer (dist/background.js), and shows the review panel. The panel lives
 * in a closed shadow root and only accepts real user clicks (event.isTrusted),
 * so page scripts can't read it or press "Continue" for you.
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
      return { enabled: true, error: "The extension was updated. Refresh this page and try again." };
    }
  }

  function reviewRequest(m) {
    // Our own view of the page's origin. Never trust one the page sends us.
    const ui = openPanel(location.origin, m.transactions.length);
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

  // ------------------------------------------------------------------ fonts
  // Self-hosted (no Google requests from the pages you visit). If a site's
  // security policy blocks them, the panel falls back to system fonts.
  let fontsAdded = false;
  function addFonts() {
    if (fontsAdded) return;
    fontsAdded = true;
    const url = (f) => chrome.runtime.getURL(`fonts/${f}`);
    const face = (fam, file, w) =>
      `@font-face{font-family:"${fam}";src:url("${url(file)}") format("woff2");font-weight:${w};font-display:swap}`;
    const style = document.createElement("style");
    style.textContent = [
      face("RBYS Roboto", "roboto-latin-400-normal.woff2", 400),
      face("RBYS Roboto", "roboto-latin-500-normal.woff2", 500),
      face("RBYS Roboto", "roboto-latin-700-normal.woff2", 700),
      face("RBYS Spartan", "league-spartan-latin-600-normal.woff2", 600),
      face("RBYS Spartan", "league-spartan-latin-700-normal.woff2", 700),
      face("RBYS Spartan", "league-spartan-latin-800-normal.woff2", 800),
    ].join("\n");
    (document.head || document.documentElement).append(style);
  }

  // ------------------------------------------------------------------ panel UI
  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
    background: rgba(3, 6, 16, .62); backdrop-filter: blur(6px);
    font: 14px/1.45 "RBYS Roboto", Roboto, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #eef1ff; }
  .card { width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
    background: #111830; border: 1px solid rgba(148,163,255,.28); border-radius: 24px; padding: 18px;
    box-shadow: 0 40px 100px -30px rgba(0,0,0,.8); }
  .h, .vs-n, .ft, .ptitle { font-family: "RBYS Spartan", "League Spartan", "RBYS Roboto", Roboto, system-ui, sans-serif; }
  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .head svg { width: 26px; height: 26px; flex: none; }
  .who { color: #8d97c4; font-weight: 500; font-size: 13px; }
  .origin { color: #8d97c4; font-size: 13px; margin: 0 0 14px; word-break: break-all; }
  .origin b { color: #eef1ff; font-weight: 500; }
  .tx + .tx { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(148,163,255,.14); }
  .txlabel { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5c668f; font-weight: 700; margin-bottom: 6px; }
  .verdict { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; border: 1px solid; }
  .verdict.high { background: rgba(255,107,129,.12); border-color: rgba(255,107,129,.45); }
  .verdict.medium { background: rgba(251,191,36,.12); border-color: rgba(251,191,36,.45); }
  .verdict.low { background: rgba(52,211,153,.12); border-color: rgba(52,211,153,.45); }
  .verdict.none { background: #0b1124; border-color: rgba(148,163,255,.14); }
  .vi { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; font-weight: 800; font-size: 18px; flex: none;
    font-family: "RBYS Spartan", "League Spartan", system-ui, sans-serif; }
  .high .vi { background: #ff6b81; color: #2a0610; } .medium .vi { background: #fbbf24; color: #2a1d02; }
  .low .vi { background: #34d399; color: #03251a; } .none .vi { background: rgba(255,255,255,.08); }
  .vt { font-size: 17px; } .vs { color: #8d97c4; font-size: 12px; }
  .score { margin-left: auto; text-align: right; }
  .vs-n { font-weight: 800; font-size: 22px; line-height: 1; }
  .high .vs-n { color: #ff6b81; } .medium .vs-n { color: #fbbf24; } .low .vs-n { color: #34d399; }
  .score span { display: block; font-size: 11px; font-weight: 500; color: #8d97c4; margin-top: 2px; }
  .flag { margin-top: 8px; padding: 12px 14px; background: #0b1124; border: 1px solid rgba(148,163,255,.14); border-radius: 12px; }
  .frow { display: grid; grid-template-columns: 18px 1fr; gap: 8px; }
  .fm { font-weight: 800; } .danger .fm { color: #ff6b81; } .warning .fm { color: #fbbf24; } .info .fm { color: #7dd3fc; }
  .ft { font-weight: 600; font-size: 14px; } .fd { color: #8d97c4; font-size: 13px; margin-top: 2px; }
  details { margin: 8px 0 0 26px; }
  summary { cursor: pointer; color: #5eead4; font-size: 12px; font-weight: 500; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "▸ "; } details[open] summary::before { content: "▾ "; }
  ul { margin: 6px 0 0; padding-left: 18px; color: #c7cdf0; font-size: 13px; }
  li + li { margin-top: 4px; }
  .protect { margin-top: 10px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(94,234,212,.35); background: rgba(94,234,212,.06); }
  .protect details { margin-left: 0; }
  .ptitle { font-weight: 700; font-size: 15px; color: #eef1ff; }
  .protect summary { font-size: 14px; color: #eef1ff; }
  .protect summary::before { color: #5eead4; }
  ol { margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #c7cdf0; }
  ol li b { color: #eef1ff; font-weight: 500; }
  .disc { margin-top: 8px; font-size: 12px; color: #8d97c4; }
  .explain { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: #0b1124; font-size: 13px; }
  .route { margin-top: 10px; color: #8d97c4; font-size: 12px; }
  .changes { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #0b1124; border: 1px solid rgba(148,163,255,.14); }
  .changes .ct { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5c668f; font-weight: 700; margin-bottom: 4px; }
  .crow { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 2px 0; }
  .crow .k { color: #8d97c4; } .crow .v { font-family: "Roboto Mono", ui-monospace, monospace; }
  .neg { color: #ff6b81; } .pos { color: #34d399; } .warnc { color: #fbbf24; }
  .spin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,.15); border-top-color: #5eead4;
    animation: s .8s linear infinite; flex: none; } @keyframes s { to { transform: rotate(360deg); } }
  .confirm { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; font-size: 13px; color: #c7cdf0; cursor: pointer; }
  .actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  button { font: 700 15px/1 "RBYS Roboto", Roboto, system-ui, sans-serif; padding: 13px 20px; border-radius: 14px; cursor: pointer; border: 0; }
  .reject { background: rgba(0,69,115,.85); color: #eef1ff; }
  .reject:hover { background: rgba(0,82,137,.95); }
  .go { background: rgba(11,17,36,.6); color: #eef1ff; border: 1px solid rgba(148,163,255,.28); }
  .go:disabled { opacity: .4; cursor: default; }
  button:focus-visible, summary:focus-visible, input:focus-visible { outline: 2px solid #5eead4; outline-offset: 2px; }
  .foot { margin-top: 10px; font-size: 11px; color: #5c668f; }
  .dock { position: sticky; bottom: -18px; margin: 0 -18px -18px; padding: 4px 18px 16px; background: linear-gradient(to bottom, rgba(17,24,48,0), #111830 14px); }
  `;

  const MARK = `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><defs><linearGradient id="rbys-g" x1="20" y1="10" x2="117.6" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#5EEAD4"/><stop offset=".45" stop-color="#38BDF8"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs><path d="M60 10 100 24v34c0 26-18 44-40 52-22-8-40-26-40-52V24L60 10Z" fill="url(#rbys-g)"/><path d="m42 60 13 13 25-27" stroke="#070B1A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const LEVEL = {
    high: ["!", "High risk", "Don't sign this unless you're sure."],
    medium: ["?", "Worth a look", "Read the notes below before signing."],
    low: ["✓", "Looks okay", "Nothing risky stood out."],
  };
  const SEV = { danger: "✖", warning: "▲", info: "ℹ" };
  const RANK = { low: 0, medium: 1, high: 2 };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function openPanel(origin, count) {
    addFonts();
    const host = document.createElement("rbys-review");
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);

    const backdrop = el("div", "backdrop");
    const card = el("div", "card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "Read Before You Sign: transaction review");
    const head = el("div", "head");
    const mark = el("span");
    mark.innerHTML = MARK; // static, trusted markup
    head.append(mark.firstChild, el("span", "who", "Read Before You Sign"));
    const originLine = el("div", "origin");
    originLine.append(el("b", null, origin), document.createTextNode(` wants your wallet to sign ${count === 1 ? "a transaction" : `${count} transactions`}.`));
    const body = el("div");
    const loading = el("div", "verdict none");
    loading.append(el("div", "spin"), el("div", "vs", "Checking what this transaction does…"));
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
    const foot = el("div", "foot", "Checked on this computer. The score comes from fixed rules, not AI.");
    // Buttons stay visible at the bottom however long the review gets.
    const dock = el("div", "dock");
    dock.append(confirm, actions, foot);
    card.append(head, originLine, body, dock);
    backdrop.append(card);
    root.append(backdrop);
    (document.body || document.documentElement).append(host);
    reject.focus();

    let done;
    const decision = new Promise((r) => (done = r));
    let worst = null;
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

    function flagCard(f) {
      const card = el("div", `flag ${f.severity}`);
      const row = el("div", "frow");
      const txt = el("div");
      txt.append(el("div", "ft", f.title), el("div", "fd", f.detail));
      row.append(el("div", "fm", SEV[f.severity] || "•"), txt);
      card.append(row);
      if (Array.isArray(f.advice) && f.advice.length) {
        const d = el("details");
        d.open = f.severity === "danger";
        d.append(el("summary", null, "What you can do"));
        const ul = el("ul");
        for (const a of f.advice) ul.append(el("li", null, a));
        d.append(ul);
        card.append(d);
      }
      return card;
    }

    // What the dry run says would actually change. This is the live proof.
    function changesCard(sim) {
      const box = el("div", "changes");
      box.append(el("div", "ct", sim.ok ? "If you sign, this changes (from a live dry run)" : "Dry run didn't complete: nothing verified"));
      const short = (a) => (a && a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || "?");
      const row = (k, v, cls) => {
        const r = el("div", "crow");
        r.append(el("span", "k", k), el("span", `v ${cls || ""}`, v));
        box.append(r);
      };
      if (sim.ok) {
        for (const b of sim.balanceChanges) {
          const d = BigInt(b.delta);
          const amt = b.kind === "sol" ? `${Number(d) / 1e9} SOL` : `${d} token units`;
          row(`${b.kind === "sol" ? "SOL" : "Tokens"} · ${short(b.address)}`, `${d > 0n ? "+" : ""}${amt}`, d < 0n ? "neg" : "pos");
        }
        for (const c of sim.delegateChanges) {
          if (c.delegateAfter) row(`New spender on ${short(c.tokenAccount)}`, c.delegatedAmountAfter === "18446744073709551615" ? `${short(c.delegateAfter)} · UNLIMITED` : `${short(c.delegateAfter)} · ${c.delegatedAmountAfter}`, "warnc");
        }
        for (const o of sim.ownerChanges) row(`New owner of ${short(o.tokenAccount)}`, short(o.after), "neg");
        if (!sim.balanceChanges.length && !sim.delegateChanges.length && !sim.ownerChanges.length) row("Balances", "no changes");
        if (sim.unitsConsumed) row("Compute used", `${sim.unitsConsumed.toLocaleString()} units`);
      }
      return box;
    }

    function protectCard(p, urgent) {
      const wrap = el("div", "protect");
      const d = el("details");
      d.open = urgent;
      const s = el("summary");
      s.append(el("span", "ptitle", "Protect your swaps from sandwich bots"));
      d.append(s);
      const ol = el("ol");
      for (const step of p.steps) {
        const li = el("li");
        li.append(el("b", null, step.title), document.createTextNode(`: ${step.detail}`));
        ol.append(li);
      }
      d.append(ol, el("div", "disc", p.disclaimer));
      wrap.append(d);
      return wrap;
    }

    function render(results, total) {
      body.replaceChildren();
      results.forEach((r, i) => {
        const sec = el("div", "tx");
        if (total > 1) sec.append(el("div", "txlabel", `Transaction ${i + 1} of ${total}`));
        if (!r || r.error) {
          const v = el("div", "verdict medium");
          const t = el("div");
          t.append(el("div", "vt", "Couldn't check this one"), el("div", "vs", (r && r.error) || "No answer from the checker."));
          v.append(el("div", "vi", "?"), t);
          sec.append(v);
          sec.append(
            flagCard({
              severity: "warning",
              title: "Be careful with anything you can't check",
              detail: "Read Before You Sign couldn't verify this transaction.",
              advice: ["If you weren't expecting a wallet request, reject it.", "Try again in a moment, or check the site is the real one."],
            })
          );
          worst = worst === "high" ? "high" : "medium";
        } else {
          const rep = r.report;
          const [icon, title, sub] = LEVEL[rep.level];
          const v = el("div", `verdict ${rep.level}`);
          const t = el("div");
          t.append(el("div", "vt", title), el("div", "vs", sub));
          const sc = el("div", "score");
          sc.append(el("div", "vs-n", String(rep.score)), el("span", null, "/ 100 risk"));
          v.append(el("div", "vi", icon), t, sc);
          sec.append(v);
          for (const f of rep.flags) sec.append(flagCard(f));
          if (r.protect) {
            const urgent = rep.flags.some((f) => f.id.startsWith("sandwich") && f.severity !== "info");
            sec.append(protectCard(r.protect, urgent));
          }
          sec.append(changesCard(rep.simulation));
          if (rep.explanationSource === "llm") sec.append(el("div", "explain", rep.explanation));
          const names = [...new Set(rep.instructions.map((x) => x.programName))].join(" → ");
          sec.append(el("div", "route", `What it calls: ${names} · checked on ${r.cluster}`));
          if (worst === null || RANK[rep.level] > RANK[worst]) worst = rep.level;
        }
        body.append(sec);
      });

      if (results.length < total) {
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
