/**
 * Generates SAMPLE transactions to test the Read Before You Sign detector.
 *
 * These are openly-labeled test fixtures built from STANDARD SPL Token
 * instructions — nothing disguised, nothing deployed to trick anyone. They
 * exist so you can confirm your detector flags the dangerous patterns it
 * should (an unlimited Approve, a SetAuthority handover).
 *
 * Usage (from /programs):
 *   npx ts-node scripts/make-sample-tx.ts approve-unlimited
 *   npx ts-node scripts/make-sample-tx.ts set-authority
 *   npx ts-node scripts/make-sample-tx.ts safe-transfer
 *   npx ts-node scripts/make-sample-tx.ts swap-loose-slippage   (10% slippage: sandwich bait)
 *   npx ts-node scripts/make-sample-tx.ts swap-tight-slippage   (0.5%: fine)
 *   npx ts-node scripts/make-sample-tx.ts swap-no-limit         (min out = 0)
 *
 * The swap samples only carry the slippage fields the detector reads (the
 * route plan is empty), so they can't execute on any cluster. They exist to
 * show the sandwich-risk check.
 *
 * Prints an unsigned base64 transaction. Paste it into the app.
 * No private keys are used; these are built with placeholder public keys.
 */
import { createHash } from "crypto";
import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createApproveInstruction,
  createSetAuthorityInstruction,
  createTransferInstruction,
  AuthorityType,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Placeholder addresses — these identify nobody real. The detector only needs
// well-formed instructions to parse and score.
const USER = new PublicKey("11111111111111111111111111111112");
const USER_TOKEN_ACCOUNT = new PublicKey("11111111111111111111111111111113");
const SOME_OTHER_PARTY = new PublicKey("11111111111111111111111111111114");
const RECENT_BLOCKHASH = "11111111111111111111111111111111";
const U64_MAX = 18446744073709551615n;
const JUPITER_V6 = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const RAYDIUM_AMM_V4 = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

const u64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };

// Jupiter v6 `route`: discriminator, route_plan (empty Vec here), in_amount,
// quoted_out_amount, slippage_bps, platform_fee_bps.
function jupiterRoute(inAmount: bigint, quotedOut: bigint, slippageBps: number) {
  const disc = createHash("sha256").update("global:route").digest().subarray(0, 8);
  const data = Buffer.concat([disc, Buffer.alloc(4), u64(inAmount), u64(quotedOut), u16(slippageBps), Buffer.from([0])]);
  return new TransactionInstruction({
    programId: JUPITER_V6,
    keys: [{ pubkey: USER, isSigner: true, isWritable: true }],
    data,
  });
}

// Raydium AMM v4 swapBaseIn: tag 9, amount_in, minimum_amount_out.
function raydiumSwapBaseIn(amountIn: bigint, minOut: bigint) {
  return new TransactionInstruction({
    programId: RAYDIUM_AMM_V4,
    keys: [{ pubkey: USER, isSigner: true, isWritable: true }],
    data: Buffer.concat([Buffer.from([9]), u64(amountIn), u64(minOut)]),
  });
}

function build(instructions: any[]): string {
  const message = new TransactionMessage({
    payerKey: USER,
    recentBlockhash: RECENT_BLOCKHASH,
    instructions,
  }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64");
}

const samples: Record<string, () => string> = {
  // The dangerous one: grants another party UNLIMITED spend. This is the
  // headline case your tool should catch and explain.
  "approve-unlimited": () =>
    build([
      createApproveInstruction(USER_TOKEN_ACCOUNT, SOME_OTHER_PARTY, USER, U64_MAX),
    ]),

  // Hands ownership of the token account to someone else.
  "set-authority": () =>
    build([
      createSetAuthorityInstruction(
        USER_TOKEN_ACCOUNT,
        USER,
        AuthorityType.AccountOwner,
        SOME_OTHER_PARTY
      ),
    ]),

  // A benign one, so you can confirm the tool DOESN'T cry wolf.
  "safe-transfer": () =>
    build([
      createTransferInstruction(USER_TOKEN_ACCOUNT, SOME_OTHER_PARTY, USER, 1_000_000),
    ]),

  // Sandwich bait: 10% slippage lets a bot take up to 10% of the trade.
  "swap-loose-slippage": () => build([jupiterRoute(1_000_000_000n, 150_000_000n, 1000)]),

  // Tight 0.5% slippage: the most a sandwich can take is 0.5%.
  "swap-tight-slippage": () => build([jupiterRoute(1_000_000_000n, 150_000_000n, 50)]),

  // No price protection at all: accepts 0 tokens back.
  "swap-no-limit": () => build([raydiumSwapBaseIn(1_000_000_000n, 0n)]),
};

const which = process.argv[2] ?? "approve-unlimited";
const make = samples[which];
if (!make) {
  console.error(`Unknown sample "${which}". Options: ${Object.keys(samples).join(", ")}`);
  process.exit(1);
}
console.log(make());
