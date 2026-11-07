/** A term with a one-line explanation on hover or keyboard focus. */
export function Tip({ term, children }: { term: string; children: string }) {
  return (
    <span className="tip" tabIndex={0}>
      {term}
      <span className="tip-body" role="tooltip">{children}</span>
    </span>
  );
}
