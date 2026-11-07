"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ShieldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" fill="currentColor" opacity=".9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" stroke="#070b1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Check" },
  { href: "/demo", label: "Demo dApp" },
  { href: "/extension", label: "Extension" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <span className="brand-mark"><ShieldIcon /></span>
        Read Before You Sign
      </Link>
      <div className="nav-links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link${path === l.href ? " active" : ""}`}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="nav-spacer" />
      <span className="pill"><span className="dot" /> Solana</span>
    </nav>
  );
}
