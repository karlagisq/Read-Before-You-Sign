# Read Before You Sign — build notes for Claude Code

A Solana transaction explainer. Paste a transaction, see what it actually does
before you approve it. Built for the MLH Solana Hackathon (Nov 6–8, 2026),
AI track.

## The one hard rule

This is a DEFENSIVE tool. Do not add anything that creates, disguises, or
deploys a deceptive/malicious transaction (e.g. a program that hides a token
`Approve` inside a friendly-looking instruction). Test fixtures must be
openly-labeled sample transactions built from standard instructions — never
something that would work as a real drainer if pointed at mainnet. If a task
seems to head that way, stop and keep it to detection only.

## How it works

```
base64 tx → decode (static)     src/lib/decode.ts
          → simulate (dry run)  src/lib/simulate.ts   (diffs accounts before/after)
          → risk rules          src/lib/risk.ts       (score + flags, DETERMINISTIC)
          → explain             src/lib/explain.ts    (LLM phrases the facts, or template)
          → UI card             src/components/Report.tsx
```

The score and flags come only from `risk.ts`. The LLM receives the structured
findings and rewords them; it must not change the verdict. Keep that split.

## Two parts

- `app/` — Next.js 15 app (the explainer). `npm install && npm run dev`.
  Copy `.env.example` to `.env.local`. Works on devnet with no API key; set
  `ANTHROPIC_API_KEY` for nicer explanations.
- `programs/` — Anchor workspace with `scam-registry`, an on-chain blocklist
  of flagged addresses. This is the Rust piece. `anchor build && anchor test`.

## Build order for the weekend

1. `app/`: get paste → decode → simulate → report working on devnet. This is
   the demo-able core; finish it first.
2. Generate sample transactions to test against:
   `cd programs && npm install && npx ts-node scripts/make-sample-tx.ts approve-unlimited`
   Paste the output into the app and confirm it flags the unlimited approval.
   Also try `safe-transfer` and confirm it does NOT cry wolf.
3. `programs/`: `anchor build`, then `anchor keys sync` to set the real program
   ID in `declare_id!` and `Anchor.toml`. `anchor test` on localnet, then
   `anchor deploy --provider.cluster devnet`.
4. Wire the registry into the detector: load flagged addresses from the
   deployed program and pass them to `assess(..., { flaggedAddresses })` in
   `src/app/api/explain/route.ts` (marked with a TODO there).

## Known gaps / TODOs (search the code for "TODO")

- Address-lookup-table accounts aren't resolved in `decode.ts`/`simulate.ts`.
  Static keys only. Fine for the demo; note it as a limitation.
- `KNOWN_PROGRAMS` in `src/lib/programs.ts` is short. Add Jupiter, Raydium,
  Metaplex so common txns read as "known".
- Anchor-program instructions decode as "unknown" (that's a correct, honest
  result). Fetching on-chain IDLs to name them is a stretch goal.
- The registry is authority-gated. Open community reporting is a stretch goal.

## Rust concepts in `programs/programs/scam-registry/src/lib.rs`

PDAs (`seeds` + `bump`), `#[account(init, ...)]` and rent, `Context<T>` with
`#[derive(Accounts)]`, account constraints (`has_one`, `seeds`), `require!`
and `#[error_code]`. The file is commented for learning — read it top to
bottom.

## Verify before submitting

- `anchor test` passes.
- The app flags `approve-unlimited` as high risk and passes `safe-transfer`.
- README has a 2-min demo script. Record the demo and submit before the
  Sunday 10:00 ET initial deadline, then polish until 11:45 ET.
