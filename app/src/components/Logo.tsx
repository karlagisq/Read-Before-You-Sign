/** The Read Before You Sign logo mark (Shield Check). Source: design/logo-mark.svg */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="rbys-mark" x1="20" y1="10" x2="117.6" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5EEAD4" />
          <stop offset=".45" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M60 10 100 24v34c0 26-18 44-40 52-22-8-40-26-40-52V24L60 10Z" fill="url(#rbys-mark)" />
      <path d="m42 60 13 13 25-27" stroke="#070B1A" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
