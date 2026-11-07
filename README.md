# Read Before You Sign

**See what a Solana transaction actually does — before you approve it.**

Wallet pop-ups show you "Approve" and a couple of numbers. Scams hide the
dangerous part where you can't see it: an instruction that quietly grants
someone unlimited permission to spend your tokens, or hands over control of
your account. This tool reads a transaction, dry-runs it against the network,
and tells you in plain English what signing would really do.

Built for the MLH Solana Hackathon (Nov 6–8, 2026), AI track.

## How it works

1. **Decode** the transaction's instructions (which programs, which accounts).
2. **Simulate** it with Solana's `simulateTransaction` RPC and diff every
   account's state before vs. after — so the findings reflect what the
   transaction *really* does, not just what it claims.
3. **Score the risk** with deterministic rules (unlimited approvals, ownership
   handovers, unknown programs, blocklisted addresses).
4. **Explain** the findings in plain language. The risk score is fixed by the
   rules; the AI only rewords the findings, it can't declare something safe.

An on-chain **scam registry** (an Anchor program, `programs/`) stores a
community blocklist of flagged addresses that the detector checks against.

## Project layout

- `app/` — the Next.js explainer (TypeScript).
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
npx ts-node scripts/make-sample-tx.ts safe-transfer       # should look OK
```

Paste the printed base64 into the app.

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
5. Mention the on-chain scam registry: the blocklist lives on Solana, so the
   check is shared and auditable.

## Limitations

Address-lookup-table accounts aren't resolved yet (static keys only). The
known-program list is short. Anchor instructions from unlisted programs show
as "unknown program," which is an honest result, not a bug.
