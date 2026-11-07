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
 *
 * Prints an unsigned base64 transaction. Paste it into the app.
 * No private keys are used; these are built with placeholder public keys.
 */
import {
  PublicKey,
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
};

const which = process.argv[2] ?? "approve-unlimited";
const make = samples[which];
if (!make) {
  console.error(`Unknown sample "${which}". Options: ${Object.keys(samples).join(", ")}`);
  process.exit(1);
}
console.log(make());
