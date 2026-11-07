"use client";
import type { Report } from "@/lib/types";

const LEVEL_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  high: { bg: "#3a1113", fg: "#ff6b6b", label: "High risk" },
  medium: { bg: "#3a2d11", fg: "#ffcc4d", label: "Worth a look" },
  low: { bg: "#113a1f", fg: "#5ee08a", label: "Looks okay" },
};

const SEV_COLOR: Record<string, string> = {
  danger: "#ff6b6b",
  warning: "#ffcc4d",
  info: "#7aa2ff",
};

export function ReportView({ report }: { report: Report }) {
  const s = LEVEL_STYLE[report.level];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: s.bg, color: s.fg, padding: 16, borderRadius: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>Risk score {report.score}/100</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{s.label}</div>
      </div>

      <section>
        <h3 style={{ margin: "0 0 6px" }}>In plain English</h3>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, margin: 0 }}>{report.explanation}</p>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
          source: {report.explanationSource}
        </div>
      </section>

      {report.flags.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 6px" }}>What to watch</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {report.flags.map((f) => (
              <div
                key={f.id}
                style={{
                  borderLeft: `3px solid ${SEV_COLOR[f.severity]}`,
                  padding: "6px 10px",
                  background: "#1a1a1f",
                  borderRadius: 6,
                }}
              >
                <div style={{ fontWeight: 600 }}>{f.title}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{f.detail}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 style={{ margin: "0 0 6px" }}>Balance changes (from simulation)</h3>
        {report.simulation.balanceChanges.length === 0 ? (
          <p style={{ opacity: 0.6, margin: 0 }}>No balance changes detected.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {report.simulation.balanceChanges.map((b, i) => (
              <li key={i}>
                {b.kind === "sol" ? "SOL" : `token ${b.mint?.slice(0, 4)}…`} on{" "}
                {b.address.slice(0, 4)}…: {Number(b.delta) > 0 ? "+" : ""}
                {b.delta}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details>
        <summary style={{ cursor: "pointer", opacity: 0.8 }}>
          Decoded instructions ({report.instructions.length})
        </summary>
        <ol style={{ paddingLeft: 18 }}>
          {report.instructions.map((ix) => (
            <li key={ix.index} style={{ marginBottom: 6 }}>
              <strong>{ix.programName}</strong> — {ix.type}
              <div style={{ fontSize: 13, opacity: 0.8 }}>{ix.summary}</div>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
