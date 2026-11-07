"use client";
import { useState } from "react";
import type { Report } from "@/lib/types";
import { ReportView } from "@/components/Report";

export default function Home() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<Report | null>(null);
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
        body: JSON.stringify({ transaction: input }),
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

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px", display: "grid", gap: 20 }}>
      <header>
        <h1 style={{ margin: 0 }}>Read Before You Sign</h1>
        <p style={{ opacity: 0.75, margin: "6px 0 0" }}>
          Paste a Solana transaction and see what it actually does before you approve it.
        </p>
      </header>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a base64 transaction…"
        rows={5}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid #333",
          background: "#141418",
          color: "inherit",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      />

      <button
        onClick={check}
        disabled={loading || !input.trim()}
        style={{
          padding: "12px 16px",
          borderRadius: 10,
          border: "none",
          background: loading ? "#444" : "#6c5ce7",
          color: "white",
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Checking…" : "Check this transaction"}
      </button>

      {error && (
        <div style={{ background: "#3a1113", color: "#ff6b6b", padding: 12, borderRadius: 10 }}>
          {error}
        </div>
      )}

      {report && <ReportView report={report} />}
    </main>
  );
}
