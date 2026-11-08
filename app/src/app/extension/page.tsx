import { ProtectSwaps } from "@/components/Guidance";

export default function ExtensionPage() {
  return (
    <main className="page">
      <div className="hero">
        <h1>
          Guard <span className="grad-text">every</span> wallet request
        </h1>
        <p>
          The extension sits between any Solana site and your wallet. When a site asks you to sign, you see what
          it really does first, plus what you can do about it. Your wallet only opens if you continue.
        </p>
      </div>

      <div className="card wide">
        <div className="card-head"><span className="card-title">Install (Chrome, Brave, Edge)</span></div>
        <ol className="steps">
          <li>Unzip <code>read-before-you-sign-extension.zip</code> somewhere you&apos;ll keep it (e.g. Documents).</li>
          <li>Open <code>chrome://extensions</code> and turn on <b>Developer mode</b> (top right).</li>
          <li>Click <b>Load unpacked</b> and choose the unzipped folder.</li>
          <li>Pin it from the puzzle-piece menu. Click the shield to pick a network: Devnet for testing, Mainnet for real funds.</li>
          <li>Try it on the <a href="/demo" style={{ color: "var(--accent)" }}>Demo dApp</a>. No app or server needs to be running: the checker is built in.</li>
        </ol>
      </div>

      <div className="grid" style={{ maxWidth: 720, margin: "18px auto 0" }}>
        <div className="tile">
          <h3>Works with your wallet</h3>
          <p>Phantom, Solflare, Backpack and any site that uses the standard Solana wallet connection.</p>
        </div>
        <div className="tile">
          <h3>Private by design</h3>
          <p>Checks run on your computer. A transaction is only sent to the Solana network for a dry run, like your wallet&apos;s own preview.</p>
        </div>
        <div className="tile">
          <h3>Tells you what to do</h3>
          <p>Every warning comes with plain steps, and swaps come with a checklist to keep sandwich bots out.</p>
        </div>
      </div>

      <div className="card wide" style={{ marginTop: 18 }}>
        <ProtectSwaps />
      </div>
    </main>
  );
}
