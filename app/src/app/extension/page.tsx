export default function ExtensionPage() {
  return (
    <main className="page">
      <div className="hero">
        <h1>
          Guard <span className="grad-text">every</span> wallet request
        </h1>
        <p>
          The extension sits between any Solana site and your wallet. When a site asks to sign, you see the
          risk review first, and the wallet only opens if you continue.
        </p>
      </div>

      <div className="card wide">
        <div className="card-head"><span className="card-title">Install (Chrome, Brave, Edge)</span></div>
        <ol className="steps">
          <li>Keep this app running (<code>npm run dev</code>). The extension sends transactions here for analysis.</li>
          <li>Open <code>chrome://extensions</code> and turn on <b>Developer mode</b> (top right).</li>
          <li>Click <b>Load unpacked</b> and choose the project&apos;s <code>extension</code> folder.</li>
          <li>Pin it, then click its icon to pick the network (Devnet for the demo) and check it&apos;s connected.</li>
          <li>Open the <a href="/demo" style={{ color: "var(--accent)" }}>Demo dApp</a> and sign a sample.</li>
        </ol>
      </div>

      <div className="grid" style={{ maxWidth: 720, margin: "18px auto 0" }}>
        <div className="tile">
          <h3>Works with your wallet</h3>
          <p>Hooks the standard wallet interfaces (Wallet Standard and the injected providers), so Phantom, Solflare, Backpack and wallet-adapter sites are covered.</p>
        </div>
        <div className="tile">
          <h3>Network-aware</h3>
          <p>Uses the chain the site asks for (mainnet/devnet) when the wallet tells it; otherwise the network you pick.</p>
        </div>
        <div className="tile">
          <h3>Fails visibly</h3>
          <p>If the analyzer can&apos;t be reached, you&apos;re told it couldn&apos;t check, never silently waved through.</p>
        </div>
      </div>
    </main>
  );
}
