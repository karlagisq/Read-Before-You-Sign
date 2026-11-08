"use client";
import type { Report } from "@/lib/types";
import { Advice, ProtectSwaps } from "@/components/Guidance";

const LEVEL = {
  high: { icon: "!", title: "High risk", sub: "Don't sign this unless you're sure.", color: "var(--danger)" },
  medium: { icon: "?", title: "Worth a look", sub: "Read the warnings before signing.", color: "var(--warn)" },
  low: { icon: "✓", title: "Looks okay", sub: "Nothing risky stood out.", color: "var(--ok)" },
} as const;

const MARK = { danger: "✖", warning: "▲", info: "ℹ" } as const;

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

function fmtDelta(kind: "sol" | "token", delta: string) {
  const n = BigInt(delta);
  const sign = n > 0n ? "+" : "";
  return kind === "sol" ? `${sign}${Number(n) / 1e9} SOL` : `${sign}${n.toString()} units`;
}

export function ReportView({ report }: { report: Report & { cluster?: string } }) {
  const L = LEVEL[report.level];
  const sim = report.simulation;

  return (
    <div className="report">
      <div className={`verdict ${report.level}`}>
        <div className="verdict-icon">{L.icon}</div>
        <div>
          <div className="verdict-title">{L.title}</div>
          <div className="verdict-sub">{L.sub}</div>
        </div>
        <div className="score">
          <b style={{ color: L.color }}>{report.score}</b>
          <span>/ 100 risk</span>
        </div>
      </div>
      <div className="meter">
        <div style={{ width: `${Math.max(report.score, 3)}%`, background: L.color }} />
      </div>

      {report.flags.length > 0 && (
        <>
          <div className="section-title">What to watch</div>
          {report.flags.map((f) => (
            <div key={f.id} className={`flag ${f.severity}`}>
              <div className="flag-mark">{MARK[f.severity]}</div>
              <div>
                <div className="flag-title">{f.title}</div>
                <div className="flag-detail">{f.detail}</div>
                <Advice items={f.advice} open={f.severity === "danger"} />
              </div>
            </div>
          ))}
        </>
      )}

      {report.instructions.some((i) => i.type === "Swap") && (
        <ProtectSwaps open={report.flags.some((f) => f.id.startsWith("sandwich") && f.severity !== "info")} />
      )}

      {report.explanationSource === "llm" && (
        <div className="panel">
          <div className="panel-label"><span>In plain English</span></div>
          <div className="explain">{report.explanation}</div>
          <div className="src">AI-worded from the findings above. It can't change the score.</div>
        </div>
      )}

      <div className="panel">
        <div className="panel-label">
          <span>Balance changes</span>
          <span>{sim.ok ? "from simulation" : "simulation failed: none verified"}</span>
        </div>
        <div className="rows">
          {sim.balanceChanges.length === 0 && <div className="row"><span className="k">None detected</span></div>}
          {sim.balanceChanges.map((b, i) => (
            <div className="row" key={i}>
              <span className="k">{b.kind === "sol" ? "SOL" : `Token ${short(b.mint ?? "?")}`} · {short(b.address)}</span>
              <span className={`v ${BigInt(b.delta) < 0n ? "neg" : "pos"}`}>{fmtDelta(b.kind, b.delta)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <details className="route">
          <summary>
            <span>Route · {report.instructions.length} instruction{report.instructions.length === 1 ? "" : "s"}</span>
            <span>show ▾</span>
          </summary>
          {report.instructions.map((ix) => (
            <div className="ix" key={ix.index}>
              <span className={`chip${ix.known ? "" : " unknown"}`}>{ix.programName}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{ix.type}</div>
                <div style={{ color: "var(--muted)" }}>{ix.summary}</div>
              </div>
            </div>
          ))}
        </details>
        <div className="rows" style={{ marginTop: 10 }}>
          <div className="row"><span className="k">Fee payer</span><span className="v">{short(report.feePayer)}</span></div>
          <div className="row"><span className="k">Network</span><span className="v">{report.cluster ?? "devnet"}</span></div>
          {sim.unitsConsumed != null && (
            <div className="row"><span className="k">Compute units</span><span className="v">{sim.unitsConsumed.toLocaleString()}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
