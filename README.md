# Read Before You Sign

**See what a Solana transaction actually does — before you approve it.**

Wallet pop-ups show you "Approve" and a couple of numbers. Scams hide the
dangerous part where you can't see it: an instruction that quietly grants
someone unlimited permission to spend your tokens, or hands over control of
your account. This tool reads a transaction, dry-runs it against the network,
and tells you in plain English what signing would really do.

Built for the MLH Solana Hackathon (Nov 6–8, 2026), AI track.

## How it works

1. **Decode** the transaction's instructions (which programs, which accounts,
   and for Jupiter/Raydium swaps, the slippage limit).
2. **Simulate** it with Solana's `simulateTransaction` RPC and diff every
   account's state before vs. after — so the findings reflect what the
   transaction *really* does, not just what it claims.
3. **Score the risk** with deterministic rules (unlimited approvals, ownership
   handovers, sandwich-attack exposure, unknown programs, blocklisted addresses).
4. **Explain** the findings in plain language. The risk score is fixed by the
   rules; the AI only rewords the findings, it can't declare something safe.

An on-chain **scam registry** (an Anchor program, `programs/`) stores a
community blocklist of flagged addresses that the detector checks against.

## Sandwich attacks

A sandwich attack targets swaps. A bot spots your swap before it lands, buys
the same token just *before* you (pushing the price up), lets your swap fill at
the worse price, then sells just *after* you and keeps the difference. On
Solana there's no public mempool, but sandwiching still happens through
bundles (e.g. Jito), cooperating validators, and RPCs that leak transactions.

The bot can only take as much as your **slippage tolerance** allows: a swap
signed with 10% slippage says "fill this even if the price is 10% worse."
That number is written into the transaction, so Read Before You Sign reads it
before you sign:

| Swap setting | Result |
| --- | --- |
| Slippage ≤ 1% | info: shows the most a sandwich could take |
| Slippage > 1% | warning: "High swap slippage invites sandwich attacks" |
| Slippage ≥ 5% | danger |
| Minimum out = 0 / maximum in = unlimited | danger: "no price protection" |

Each finding shows the actual numbers: *you'd accept as little as X tokens
back instead of the quoted Y*.

**What it does not do:** it can't see or block the bot. A sandwich happens
after you sign, by someone else. The tool shows your maximum exposure so you
can tighten slippage or send through an MEV-protected route before signing.
Supported today: Jupiter v6 (`route`, `shared_accounts_route`, and the
exact-out variants) and Raydium AMM v4. Other DEXes show as known programs
without a slippage reading.

## Use it in the terminal

```bash
cd app
npm install
npm link                     # installs the `rbys` command

rbys <base64-transaction>    # or a bare message from `solana ... --dump-transaction-message`
some-command | rbys          # reads stdin
rbys --file tx.txt
rbys -c mainnet <tx>         # simulate on mainnet (default: devnet)
rbys --json <tx>             # machine-readable report
```

Exit codes: `0` looks okay, `2` worth a look, `3` high risk, `1` error. So
you can gate a send in a script: `rbys "$TX" && <send it>`.

It reads `app/.env.local` for `REGISTRY_PROGRAM_ID` and `ANTHROPIC_API_KEY`.
The scam registry is always read from devnet (where it's deployed); set
`REGISTRY_RPC_URL` to change that. The web UI (`npm run dev`) runs the
same pipeline (`src/lib/analyze.ts`).

## Project layout

- `app/` — the detector (TypeScript): `rbys` terminal command (`src/cli.ts`)
  and a Next.js web UI, both on the shared pipeline in `src/lib/`.
- `programs/` — the Anchor workspace (Rust): `scam-registry`.

## Quick start

```bash
# the app
cd app
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000, devnet by default

# the Anchor program
cd ../programs
npm install
anchor build
anchor keys sync       # writes the real program ID
anchor test            # localnet
```

## Try it

```bash
cd programs
npx ts-node scripts/make-sample-tx.ts approve-unlimited   # should flag HIGH
npx ts-node scripts/make-sample-tx.ts safe-transfer       # see note below
npx ts-node scripts/make-sample-tx.ts swap-loose-slippage | rbys   # HIGH: 10% slippage
npx ts-node scripts/make-sample-tx.ts swap-tight-slippage | rbys   # 0.5%: shows exposure only
npx ts-node scripts/make-sample-tx.ts swap-no-limit | rbys         # HIGH: min out = 0
```

Pipe the output into `rbys`, or paste it into the web UI. The samples use
placeholder accounts, so the simulation step fails on them and adds a
"failed to simulate" warning (+20). That's honest: the tool can't verify a
transaction it can't run.

> These sample transactions are openly-labeled test fixtures built from
> standard SPL instructions. This project is strictly defensive: it detects
> dangerous transactions, it does not create deceptive ones.

## Demo script (2 min)

1. Here's the problem: a wallet pop-up only shows "Approve". Show a scammy
   approval request.
2. Paste the same transaction into Read Before You Sign.
3. It flags **"Grants UNLIMITED spending of your tokens"** and explains who
   gets access to what.
4. Paste a safe transfer — it comes back clean. No crying wolf.
5. Sandwich risk: pipe `swap-loose-slippage` into `rbys`. It shows a bot
   could take up to 10% and the exact token amount, then `swap-tight-slippage`
   shows 0.5%. Say plainly: it doesn't stop the bot, it shows your exposure
   before you sign.
6. Mention the on-chain scam registry: the blocklist lives on Solana, so the
   check is shared and auditable.

## Limitations

Sandwich checks read the slippage a swap declares. They can't detect an
actual sandwich (that happens after signing). Only Jupiter v6 and Raydium AMM
v4 swaps are read so far. Address-lookup-table accounts aren't resolved yet (static keys only). The
known-program list is short. Anchor instructions from unlisted programs show
as "unknown program," which is an honest result, not a bug.
