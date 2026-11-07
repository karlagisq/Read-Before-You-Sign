"use client";
import { useState } from "react";
import Link from "next/link";
import type { Report } from "@/lib/types";
import { ReportView } from "@/components/Report";

type Cluster = "devnet" | "mainnet";

export default function Home() {
  const [input, setInput] = useState("");
  const [cluster, setCluster] = useState<Cluster>("devnet");
  const [report, setReport] = useState<(Report & { cluster?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transaction: input, cluster }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function paste() {
    try {
      setInput((await navigator.clipboard.readText()).trim());
    } catch {
      /* clipboard blocked: user can paste manually */
    }
  }

  return (
    <main className="page">
      <div className="hero">
        <h1>
          Know what you sign, <span className="grad-text">before</span> you sign.
        </h1>
        <p>
          Paste any Solana transaction to see what it really does, or install the extension to check every
          wallet request automatically.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Check a transaction</span>
          <div className="segmented" role="tablist" aria-label="Network">
            {(["devnet", "mainnet"] as const).map((c) => (
              <button key={c} className={cluster === c ? "on" : ""} onClick={() => setCluster(c)}>
                {c === "devnet" ? "Devnet" : "Mainnet"}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-label">
            <span>You&apos;re being asked to sign</span>
            <button className="link-btn" onClick={paste}>Paste</button>
          </div>
          <textarea
            className="tx-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Base64 transaction or message…"
            spellCheck={false}
          />
        </div>

        <button className="btn-primary" onClick={check} disabled={loading || !input.trim()}>
          {loading ? "Simulating…" : input.trim() ? "Check transaction" : "Paste a transaction"}
        </button>

        {error && <div className="error">{error}</div>}
        {report && <ReportView report={report} />}
      </div>

      <div className="grid" style={{ maxWidth: 720, margin: "28px auto 0" }}>
        <div className="tile">
          <h3>Check every request automatically</h3>
          <p>The browser extension reviews each transaction a site sends to Phantom, Solflare or Backpack before the wallet opens.</p>
          <Link href="/extension"><button className="btn-ghost">Get the extension</button></Link>
        </div>
        <div className="tile">
          <h3>Try it on a demo dApp</h3>
          <p>Openly-labeled sample transactions: unlimited approvals, account handovers, sandwich-prone swaps.</p>
          <Link href="/demo"><button className="btn-ghost">Open demo dApp</button></Link>
        </div>
      </div>
    </main>
  );
}
