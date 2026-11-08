"use client";
import { useEffect, useState } from "react";
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { SAMPLES, buildSample, type Sample } from "@/lib/samples";
import { Buffer } from "buffer";

/**
 * Demo dApp: a stand-in for "any Solana site". Each button asks the wallet to
 * sign an openly-labeled sample transaction. With the extension installed,
 * the Read Before You Sign review appears BEFORE the wallet popup.
 * We only ever call signTransaction: nothing is ever sent to the network.
 */

interface LegacyProvider {
  publicKey?: PublicKey | null;
  isDemo?: boolean;
  connect?: () => Promise<{ publicKey: PublicKey } | void>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
}

declare global {
  interface Window {
    solana?: LegacyProvider;
    phantom?: { solana?: LegacyProvider };
    solflare?: LegacyProvider;
    backpack?: LegacyProvider;
  }
}

function findWallet(): { name: string; provider: LegacyProvider } | null {
  const w = window;
  if (w.phantom?.solana) return { name: "Phantom", provider: w.phantom.solana };
  if (w.solflare) return { name: "Solflare", provider: w.solflare };
  if (w.backpack) return { name: "Backpack", provider: w.backpack };
  if (w.solana) return { name: w.solana.isDemo ? "Demo wallet" : "Wallet", provider: w.solana };
  return null;
}

/** A keyless stand-in wallet so the demo works without installing one. */
function installDemoWallet(): LegacyProvider {
  const demo: LegacyProvider = {
    isDemo: true,
    publicKey: Keypair.generate().publicKey,
    async connect() {
      return { publicKey: this.publicKey! };
    },
    async signTransaction(tx) {
      return tx; // pretends the user approved; holds no keys, signs nothing
    },
  };
  // Assigning to window.solana lets the extension see and guard it like a real wallet.
  window.solana = demo;
  return window.solana;
}

interface LiveSample { id: string; title: string; pitch: string; expect: "high" | "medium" | "low"; base64: string }
interface LiveFixtures { cluster: string; wallet: string; mint: string; generatedAt: string; samples: LiveSample[] }

export default function Demo() {
  const [wallet, setWallet] = useState<{ name: string; provider: LegacyProvider; pubkey: PublicKey } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState<LiveFixtures | null>(null);

  // Real devnet transactions made by `npm run devnet-fixtures` in programs/ (optional).
  useEffect(() => {
    fetch("/devnet-fixtures.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.samples?.length && setLive(j))
      .catch(() => {});
  }, []);

  async function runLive(s: LiveSample) {
    if (!wallet) return;
    setBusy(s.id);
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(s.base64, "base64"));
      note(`Asking ${wallet.name} to sign: ${s.title}`);
      await wallet.provider.signTransaction(tx);
      note(`✔ "${s.title}" approved in the review (not sent: this page never broadcasts)`);
    } catch (e) {
      note(`✖ Rejected: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }
  const note = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 12));

  async function connect(useDemo = false) {
    const found = useDemo ? null : findWallet();
    const w = found ?? { name: "Demo wallet", provider: installDemoWallet() };
    const res = await w.provider.connect?.();
    const pubkey = (res && "publicKey" in res ? res.publicKey : null) ?? w.provider.publicKey;
    if (!pubkey) return note("Wallet didn't return a public key.");
    setWallet({ ...w, pubkey: new PublicKey(pubkey.toString()) });
    note(`Connected ${w.name} ${pubkey.toString().slice(0, 4)}…`);
  }

  async function run(sample: Sample) {
    if (!wallet) return;
    setBusy(sample.id);
    try {
      let blockhash = "11111111111111111111111111111111";
      try {
        blockhash = (await new Connection("https://api.devnet.solana.com").getLatestBlockhash()).blockhash;
      } catch {
        /* offline: placeholder blockhash is fine, we never send */
      }
      const tx = buildSample(sample, wallet.pubkey, blockhash);
      note(`Asking ${wallet.name} to sign: ${sample.title}`);
      await wallet.provider.signTransaction(tx);
      note(`✔ Wallet signed "${sample.title}" (not sent: this page never broadcasts)`);
    } catch (e) {
      note(`✖ Rejected: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="page">
      <div className="hero">
        <h1>Demo dApp</h1>
        <p>Stands in for any Solana site. Click a button and watch the review appear before your wallet opens.</p>
      </div>

      <div className="banner">
        <b>Test page.</b> Every button asks your wallet to sign an openly-labeled <b>sample</b> transaction built
        from standard instructions with placeholder accounts that don&apos;t exist, so none of them can move
        funds. This page only calls <code>signTransaction</code> and never sends anything. Use a devnet wallet.
      </div>

      <div className="card wide">
        <div className="card-head">
          <span className="card-title">{wallet ? `${wallet.name} · ${wallet.pubkey.toBase58().slice(0, 4)}…${wallet.pubkey.toBase58().slice(-4)}` : "Connect a wallet"}</span>
          {!wallet && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={() => connect(false)}>Connect wallet</button>
              <button className="btn-ghost" onClick={() => connect(true)}>Use demo wallet</button>
            </div>
          )}
        </div>

        <div className="grid" style={{ marginTop: 4 }}>
          {SAMPLES.map((s) => (
            <div className="tile" key={s.id}>
              <h3>
                {s.title}
                <span className={`expect ${s.expect}`}>{s.expect === "high" ? "should flag" : "should pass*"}</span>
              </h3>
              <p>{s.pitch}</p>
              <button className="btn-ghost" disabled={!wallet || busy !== null} onClick={() => run(s)}>
                {busy === s.id ? "Waiting for review…" : "Sign sample"}
              </button>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--faint)", fontSize: 12, margin: "12px 4px 0" }}>
          * These show &ldquo;worth a look&rdquo; rather than &ldquo;looks okay&rdquo;: their placeholder accounts make the dry
          run fail, and the tool honestly says it couldn&apos;t verify them.
        </p>
        {live && (
          <>
            <div className="section-title" style={{ marginTop: 22 }}>Live on devnet</div>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 4px 0", lineHeight: 1.5 }}>
              Real transactions on your own devnet test accounts (wallet {live.wallet.slice(0, 4)}…{live.wallet.slice(-4)}), so the
              dry run succeeds and shows what would really change. Use <b>Use demo wallet</b> for these: they belong to your
              command-line devnet wallet, not to Phantom. Set the extension to Devnet.
            </p>
            <div className="grid" style={{ marginTop: 10 }}>
              {live.samples.map((s) => (
                <div className="tile" key={s.id}>
                  <h3>
                    {s.title.replace(/^LIVE: /, "")}
                    <span className={`expect ${s.expect}`}>{s.expect === "high" ? "should flag" : "should pass"}</span>
                  </h3>
                  <p>{s.pitch}</p>
                  <button className="btn-ghost" disabled={!wallet || busy !== null} onClick={() => runLive(s)}>
                    {busy === s.id ? "Waiting for review…" : "Sign live sample"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {!live && (
          <p style={{ color: "var(--faint)", fontSize: 12, margin: "14px 4px 0" }}>
            Want the live version? Run <code>npm run devnet-fixtures</code> in <code>programs/</code> to add real devnet samples here.
          </p>
        )}

        {log.length > 0 && <div className="log">{log.join("\n")}</div>}
      </div>
    </main>
  );
}
