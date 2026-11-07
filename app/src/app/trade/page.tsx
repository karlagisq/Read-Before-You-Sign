"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { Portfolio } from "@/lib/portfolio";
import { PortfolioView } from "@/components/trade/Portfolio";
import { Tip } from "@/components/trade/Tip";

/**
 * Trade safely: protection for trades YOU start.
 *   1 Connect & Risk  (this step: wallet + portfolio snapshot; risk score next)
 *   2 Simulate        (Jupiter quote + sandwich exposure)  — coming
 *   3 Protect         (tight slippage + private Jito bundle) — coming
 * Read-only: we only ever use your PUBLIC address here.
 */
const STEPS = ["Connect & Risk", "Simulate", "Protect"];

export default function Trade() {
  const { publicKey } = useWallet();
  const [address, setAddress] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (body: { address?: string; demo?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that wallet.");
      setPortfolio(data);
    } catch (e) {
      setPortfolio(null);
      setError(e instanceof Error ? e.message : "Couldn't read that wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Connected wallet → read its public address automatically.
  useEffect(() => {
    if (publicKey) {
      setAddress(publicKey.toBase58());
      load({ address: publicKey.toBase58() });
    }
  }, [publicKey, load]);

  return (
    <main className="page">
      <div className="hero">
        <h1>
          Trade <span className="grad-text">without</span> getting sandwiched.
        </h1>
        <p>
          Check a token before you buy, see what a <Tip term="sandwich bot">A bot that buys just before your trade and sells just after it, keeping the price difference.</Tip>{" "}
          could take, then send it through a protected route.
        </p>
      </div>

      <ol className="stepper" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === 0 ? "on" : "locked"} aria-current={i === 0 ? "step" : undefined}>
            <span className="step-n">{i + 1}</span>
            {s}
            {i > 0 && <span className="soon">soon</span>}
          </li>
        ))}
      </ol>

      <div className="card">
        <div className="card-head">
          <span className="card-title">1 · Connect a wallet</span>
          <span className="pill" title="We only read your public address. Nothing here asks you to sign.">read-only</span>
        </div>

        <div className="connect-row">
          <WalletMultiButton />
          <button className="btn-ghost" onClick={() => load({ demo: true })} disabled={loading}>
            Use demo wallet
          </button>
        </div>

        <div className="panel">
          <div className="panel-label">
            <span>…or look up any address</span>
            <span className="faint">public info only</span>
          </div>
          <form
            className="lookup"
            onSubmit={(e) => {
              e.preventDefault();
              if (address.trim()) load({ address: address.trim() });
            }}
          >
            <input
              className="tx-input lookup-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Wallet address (e.g. 7xKX…)"
              spellCheck={false}
              aria-label="Wallet address"
            />
            <button className="link-btn" type="submit" disabled={loading || !address.trim()}>
              Read
            </button>
          </form>
        </div>

        {loading && <div className="src" style={{ margin: "12px 4px" }}>Reading wallet…</div>}
        {error && <div className="error">{error}</div>}
        {portfolio && <PortfolioView p={portfolio} />}
      </div>
    </main>
  );
}
