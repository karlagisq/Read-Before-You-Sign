import { PROTECT_DISCLAIMER, PROTECT_SWAPS } from "@/lib/guidance";

/** "What you can do" list under a finding. Open by default for dangerous ones. */
export function Advice({ items, open }: { items?: string[]; open?: boolean }) {
  if (!items?.length) return null;
  return (
    <details className="advice" open={open}>
      <summary>What you can do</summary>
      <ul>
        {items.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </details>
  );
}

/** Sandwich-attack protection checklist. */
export function ProtectSwaps({ open = false }: { open?: boolean }) {
  return (
    <details className="protect" open={open}>
      <summary>Protect your swaps from sandwich bots</summary>
      <ol>
        {PROTECT_SWAPS.map((s) => (
          <li key={s.title}>
            <b>{s.title}</b>: {s.detail}
          </li>
        ))}
      </ol>
      <div className="disc">{PROTECT_DISCLAIMER}</div>
    </details>
  );
}
