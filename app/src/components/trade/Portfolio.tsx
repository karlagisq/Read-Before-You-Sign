"use client";
import type { Portfolio } from "@/lib/portfolio";
import { Tip } from "./Tip";

const usd = (n: number | null) =>
  n == null ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const amt = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : s;
};
const ago = (t: number) => {
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export function PortfolioView({ p, onPickToken }: { p: Portfolio; onPickToken?: (mint: string) => void }) {
  return (
    <div className="report">
      <div className="panel">
        <div className="panel-label">
          <span>
            {p.source === "demo" ? "Demo wallet" : "Wallet"} · <span className="mono">{short(p.address)}</span>
          </span>
          <span>
            {p.source === "demo" ? "sample data" : <>read via <Tip term="Helius">A Solana data provider: it returns balances and readable history so we don&apos;t decode raw accounts.</Tip></>}
          </span>
        </div>
        <div className="total">{usd(p.totalUsd)}</div>
        <div className="src">Total value of SOL and priced tokens · {p.cluster}</div>
      </div>

      <div className="section-title">Balances</div>
      <div className="panel">
        <div className="rows">
          <div className="row holding">
            <span className="k"><b className="sym">SOL</b> Solana</span>
            <span className="v">{amt(p.sol.amount)} <span className="faint">{usd(p.sol.usd)}</span></span>
          </div>
          {p.tokens.map((t) => (
            <div className="row holding" key={t.mint}>
              <span className="k">
                <b className="sym">{t.symbol}</b> {t.name}{" "}
                <span className="faint mono" title={t.mint}>
                  <Tip term={short(t.mint)}>The token&apos;s mint address: its unique ID on Solana. Names can be copied; mints can&apos;t.</Tip>
                </span>
              </span>
              <span className="v">
                {amt(t.amount)} <span className="faint">{usd(t.usd)}</span>
                {onPickToken && (
                  <button className="link-btn" style={{ marginLeft: 10 }} onClick={() => onPickToken(t.mint)}>
                    Check risk
                  </button>
                )}
              </span>
            </div>
          ))}
          {p.tokens.length === 0 && <div className="row"><span className="k">No tokens besides SOL.</span></div>}
        </div>
      </div>

      <div className="section-title">Recent activity</div>
      <div className="panel">
        <div className="rows">
          {p.transfers.length === 0 && <div className="row"><span className="k">No recent transactions found.</span></div>}
          {p.transfers.map((t) => (
            <div className="activity" key={t.signature}>
              <div className="activity-top">
                <span className="chip">{t.type.replace(/_/g, " ").toLowerCase()}</span>
                <span className="faint">{ago(t.time)}</span>
              </div>
              <div className="activity-desc">{t.description}</div>
              {t.changes.length > 0 && (
                <div className="activity-changes">
                  {t.changes.map((c) => (
                    <span key={c.symbol} className={c.amount.startsWith("-") ? "neg" : "pos"}>
                      {c.amount.startsWith("-") ? "-" : "+"}{amt(c.amount.replace(/^[+-]/, ""))} {c.symbol}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
