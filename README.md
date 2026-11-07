# Read Before You Sign

**See what a Solana transaction actually does — before your wallet opens.**

Wallet pop-ups show you "Approve" and a couple of numbers. Scams hide the
dangerous part where you can't see it: an instruction that quietly grants
someone unlimited permission to spend your tokens, hands over control of your
account, or a swap with loose slippage that invites sandwich bots. Read Before
You Sign reads the transaction, dry-runs it on Solana, and tells you in plain
English what signing would really do.

It works where you already are: a **browser extension** steps in between any
Solana site and your wallet (Phantom, Solflare, Backpack, any wallet-adapter
site) and shows the review *before* the wallet popup. There's also a web
checker and an `rbys` terminal command on the same engine.

Built for the MLH Solana Hackathon (Nov 6–8, 2026), AI track.

## What it's for

| Who | Use |
| --- | --- |
| **Everyday wallet users** | Catch drainer sites: the fake "claim airdrop" or "mint" button whose transaction actually grants unlimited spending or hands over a token account. |
| **Traders** | See your sandwich-attack exposure on every swap: "a bot can take up to 10% — you'd accept 135 instead of the quoted 150." Tighten slippage before signing. |
| **New users** | Learn what transactions do in plain English, with the risky part highlighted, instead of trusting a pop-up. |
| **dApp developers / QA** | Run your own transactions through the checker to see how a careful wallet user will read them; spot an accidental unlimited approval before shipping. |
| **Teams & DAOs (multisig signers)** | Paste a proposed transaction and read it before co-signing. |
| **Scripts & bots** | `rbys` exits `0/2/3` (ok / worth a look / high risk), so automation can refuse to send risky transactions. |
| **The community** | The on-chain scam registry is a shared, auditable blocklist; every checker reads the same list straight from Solana. |

## How it works

```
site asks wallet to sign
        │
        ▼
extension (inject.js) pauses the request ──► analyzer API  ─► decode instructions (+ swap slippage)
        │                                                    ─► simulate on Solana, diff accounts before/after
        │                                                    ─► read on-chain scam registry
        │                                                    ─► deterministic risk rules → score + flags
        │                                                    ─► AI rewords the findings (optional)
        ▼
review panel: Reject  /  Continue to wallet  ──► wallet popup opens only if you continue
```

1. **Decode** the instructions: which programs, which accounts, and for
   Jupiter/Raydium swaps, the slippage limit.
2. **Simulate** with Solana's `simulateTransaction` and diff every writable
   account before vs. after, so findings reflect what the transaction *really*
   does, not just what it claims.
3. **Score** with deterministic rules: unlimited approvals, ownership
   handovers, sandwich exposure, unknown programs, blocklisted addresses.
4. **Explain** in plain language. The score is fixed by the rules; the AI only
   rewords the findings and can't declare something safe.

The **scam registry** (an Anchor program in `programs/`, deployed on devnet)
stores one PDA per flagged address. The analyzer reads all entries with a
single `getProgramAccounts` call.

## Trade safely (Sandwich Guard) — in progress

`/trade` protects trades **you** start, in three steps:

1. **Connect & Risk** ✅ — connect Phantom/Solflare (read-only), or look up any
   address, or use the demo wallet. Helius shows SOL + token balances with USD
   values and readable recent activity. *Next: a 0–100 token risk score with
   reasons (liquidity, price impact, mint/freeze authority, holder
   concentration, volatility, pool age).*
2. **Simulate** — Jupiter quote → expected out, minimum out, price impact, and
   an estimate of what a sandwich could extract at your slippage.
3. **Protect** — rebuild the swap with tight slippage, add a Jito tip, send it
   as a private bundle, show before/after. Always a confirmation screen;
   never auto-sign.

```
browser ──POST /api/portfolio──► Next.js server ──► Helius DAS getAssetsByOwner
   (public address only)          (HELIUS_API_KEY,       + Enhanced Transactions
                                   never sent to browser)
```

Env: `HELIUS_API_KEY` (free at dashboard.helius.dev; without it `/trade` runs
on demo data), `HELIUS_CLUSTER` (`mainnet` default). The demo wallet and the
`DEMOCAT` memecoin are randomly generated addresses that belong to nobody.

**What it does not do:** it never asks for a seed phrase or private key, never
holds funds, and doesn't build bots or touch anyone else's trades. Protection
*reduces exposure*; it can't prevent every sandwich.

## Sandwich attacks

A sandwich attack targets swaps. A bot spots your swap before it lands, buys
the same token just *before* you (pushing the price up), lets your swap fill at
the worse price, then sells just *after* you and keeps the difference. Solana
has no public mempool, but sandwiching still happens through bundles (e.g.
Jito), cooperating validators, and RPCs that leak transactions.

The bot can only take as much as your **slippage tolerance** allows: a swap
signed with 10% slippage says "fill this even if the price is 10% worse."
That number is written into the transaction, so we read it before you sign:

| Swap setting | Result |
| --- | --- |
| Slippage ≤ 1% | info: shows the most a sandwich could take |
| Slippage > 1% | warning: "High swap slippage invites sandwich attacks" |
| Slippage ≥ 5% | danger |
| Minimum out = 0 / maximum in = unlimited | danger: "no price protection" |

**What it does not do:** it can't see or block the bot. A sandwich happens
after you sign, by someone else. The tool shows your maximum exposure so you
can tighten slippage or use an MEV-protected send *before* signing.
Supported: Jupiter v6 (`route`, `shared_accounts_route`, exact-out variants)
and Raydium AMM v4.

## Quick start

```bash
# 1. the analyzer + web UI
cd app
npm install
cp .env.example .env.local      # set REGISTRY_PROGRAM_ID, optional ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000

# 2. the extension (Chrome / Brave / Edge)
#    chrome://extensions → Developer mode → Load unpacked → choose ./extension
#    click the extension icon → pick Devnet → it should say "Connected"

# 3. the Anchor program
cd ../programs
npm install
anchor build && anchor keys sync && anchor build && anchor test
anchor deploy --provider.cluster devnet
```

Then open **http://localhost:3000/demo**, choose **Use demo wallet** (keyless)
or connect a devnet Phantom, and sign a sample.

### Terminal (optional)

```bash
cd app && npm link              # installs `rbys`
rbys <base64-tx>                # or pipe: some-command | rbys
rbys -c mainnet --json <tx>
```

## Demo script (2 minutes)

**0:00 — The problem (15s).** "Every Solana wallet popup asks you to trust a
button. Drainer sites exploit that: the button says *Claim airdrop*, the
transaction says *give this stranger unlimited access to your tokens*. And on
swaps, loose slippage quietly hands money to sandwich bots."

**0:15 — It's already there (25s).** Open the Demo dApp (it stands in for any
Solana site). Click **Unlimited token approval**. *Before* the wallet opens,
the Read Before You Sign panel appears: **High risk — Grants UNLIMITED
spending of your tokens**, naming who gets access. Point out **Continue** is
locked until you tick "I understand the risk." Click **Reject**: the site gets
a normal "user rejected" error.

**0:40 — Sandwich exposure (30s).** Click **Swap with 10% slippage**: "High
swap slippage invites sandwich attacks — you'd accept as little as 135 instead
of the quoted 150." Then **Swap with 0.5% slippage**: the most a bot could take
is 0.5%. Say it precisely: *we don't stop the bot; we show your exposure
before you sign, so you can fix it.*

**1:10 — On-chain registry (25s).** Run `flag-address.ts` on the sample
recipient (the Rust/Anchor program on devnet). Sign the transfer sample again:
**"Touches an address on the community blocklist."** The list lives on
Solana: shared, auditable, one PDA per address.

**1:35 — Where the AI fits (15s).** "Detection is deterministic rules plus a
real Solana simulation. The AI only turns those findings into plain English.
It can't change the score or call something safe."

**1:50 — Close (10s).** "Read Before You Sign: know what you sign, before you
sign. Works with the wallet you already use."

*Recording tips:* run the demo on devnet; record at 1280×800; keep the
extension popup pinned so viewers see it's a real extension.

## Features worth looking into next

Highest impact first:

1. **Approvals scanner + revoke.** List every token account in a wallet with
   an active delegate (`getTokenAccountsByOwner`, check `delegate`), show who
   can spend what, and offer a one-click `Revoke`. Catches damage that
   already happened.
2. **Address-lookup-table resolution.** Most Jupiter swaps use v0
   transactions with ALTs; resolving them makes simulation diffs and registry
   matches complete on real mainnet swaps.
3. **Sign-message (SIWS) review.** Wallets also sign messages; phishing sites
   use them for fake logins. Show the message and the domain it claims.
4. **More DEX decoders.** Jupiter `route_v2`, Orca Whirlpools, Meteora,
   Raydium CLMM/CPMM, and pump.fun bonding-curve buys (slippage there is
   `max_sol_cost`).
5. **Price-aware amounts.** Convert token units to dollars (Jupiter price API)
   so "135000000 units" becomes "$13.50 at risk."
6. **Open community reporting.** Let anyone submit a report PDA with a stake;
   the authority (or a DAO vote) confirms. Today the registry is
   authority-gated.
7. **Domain checks.** Flag look-alike domains of popular dApps (punycode,
   typosquats) next to the transaction review.
8. **Token-2022 extensions.** Warn on permanent-delegate, transfer-hook, and
   freeze-authority mints; these can take or lock tokens later.
9. **Hosted analyzer + store listing.** Deploy the API (e.g. Vercel) with a
   private RPC so the extension works without a local server, then publish
   to the Chrome Web Store.
10. **Mobile.** Wallet in-app browsers can't load extensions; a deep-link
    "check this transaction" share target would cover them.

## Project layout

- `extension/` — the browser extension (Manifest V3): `inject.js` wraps the
  wallet's signing methods, `bridge.js` shows the review panel,
  `background.js` calls the analyzer, `popup.html` holds settings.
- `app/` — analyzer + UI (TypeScript/Next.js): `src/lib/` is the engine,
  `src/app/` the web UI (`/` checker, `/demo` demo dApp, `/extension`
  install guide), `src/cli.ts` the `rbys` command.
- `programs/` — the Anchor workspace (Rust): `scam-registry`, plus scripts to
  flag addresses and generate sample transactions.
- `design/` — theme tokens, the Figma link, and `apply-tokens.mjs` to push
  color changes into the web app, extension and CLI. See `design/README.md`.

## Try the samples

```bash
cd programs
npx ts-node scripts/make-sample-tx.ts approve-unlimited | rbys     # HIGH
npx ts-node scripts/make-sample-tx.ts swap-loose-slippage | rbys   # HIGH: 10% slippage
npx ts-node scripts/make-sample-tx.ts swap-tight-slippage | rbys   # exposure 0.5%
npx ts-node scripts/make-sample-tx.ts swap-no-limit | rbys         # HIGH: min out = 0
npx ts-node scripts/make-sample-tx.ts safe-transfer | rbys
```

The samples use placeholder accounts, so the simulation step fails on them and
adds a "failed to simulate" warning (+20). That's honest: the tool can't verify
a transaction it can't run.

> These sample transactions are openly-labeled test fixtures built from
> standard instructions. This project is strictly defensive: it detects
> dangerous transactions, it does not create deceptive ones.

## Privacy & security

The extension is **advisory**: it can pause or reject a request, but it holds
no keys, can't sign, and never changes a transaction. Your wallet still asks
you to approve in its own popup.

| Concern | How it's handled |
| --- | --- |
| Pending transactions leaking (a bot that sees your swap early can sandwich it) | The extension only sends transactions to an analyzer **on your own computer** (`localhost`). Remote URLs are refused in both the settings and the background worker. |
| What the analyzer sends out | The transaction goes to the Solana RPC for simulation (same as your wallet's own preview). Use a trusted or private RPC via `SOLANA_RPC_URL` / `MAINNET_RPC_URL`. If you set an Anthropic key, only the **findings** (not the raw transaction) are sent for wording. Nothing is logged or stored. |
| Websites abusing your local analyzer | `/api/explain` rejects cross-site browser requests (403). Only the app itself, the extension, and command-line tools can call it. |
| A phishing page faking its identity | The panel shows the site's origin as Chrome reports it to the extension, not what the page claims. |
| A page reading or clicking the panel | The panel lives in a closed shadow root in the extension's isolated world and only accepts real user clicks (`isTrusted`). On high risk, Continue stays locked until you tick a box. |
| Stored data | Only three settings (on/off, default network, analyzer URL) in `chrome.storage`. No history, no keys. |
| Supply chain | The extension has zero third-party dependencies and no remote code (Manifest V3 forbids it). Permissions: `storage` plus `localhost` only. |

## Limitations

- The extension wraps wallet methods in the page, as wallet-guard extensions
  do. A site written specifically to evade this extension could bypass it;
  it protects against everyday risky and phishing transactions. The review
  panel itself sits in a closed shadow root and only accepts real clicks, so
  a page can't read it or press Continue for you.
- The analyzer runs locally (`localhost:3000`) for the hackathon; see
  "Hosted analyzer" above.
- Sandwich checks read the slippage a swap declares; they can't detect an
  actual sandwich. Only Jupiter v6 and Raydium AMM v4 are decoded.
- Address-lookup-table accounts aren't resolved (static keys only).
- Instructions from unlisted programs show as "unknown program," which is an
  honest result, not a bug.
