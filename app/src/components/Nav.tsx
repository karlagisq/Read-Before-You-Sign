"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";

const LINKS = [
  { href: "/", label: "Check" },
  { href: "/trade", label: "Trade" },
  { href: "/demo", label: "Demo dApp" },
  { href: "/extension", label: "Extension" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="brand" aria-label="Read Before You Sign: home" title="Read Before You Sign">
        <LogoMark className="brand-logo" />
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
