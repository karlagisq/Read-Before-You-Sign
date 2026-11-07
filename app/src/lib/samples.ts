/**
 * Openly-labeled SAMPLE transactions for the demo page. Same idea as
 * programs/scripts/make-sample-tx.ts: standard instructions, placeholder
 * accounts that nobody controls, nothing disguised. They let you show the
 * guard catching each pattern. The only real key is the fee payer (your
 * wallet, so the wallet will open it), and the token accounts don't exist, so
 * none of these can move anything even if signed.
 */
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import {
  AuthorityType,
  createApproveInstruction,
  createSetAuthorityInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { Buffer } from "buffer";
import { JUPITER_V6, RAYDIUM_AMM_V4, U64_MAX } from "./programs";

const PLACEHOLDER_TOKEN_ACCOUNT = new PublicKey("11111111111111111111111111111113");
const PLACEHOLDER_OTHER_PARTY = new PublicKey("11111111111111111111111111111114");

const u64 = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
};
const u16 = (n: number) => {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
};
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) (out.set(p, o), (o += p.length));
  return out;
};

// sha256("global:route")[0..8], precomputed so this runs in the browser.
const JUPITER_ROUTE_DISC = Uint8Array.from([0xe5, 0x17, 0xcb, 0x97, 0x7a, 0xe3, 0xad, 0x2a]);

function jupiterRoute(payer: PublicKey, inAmount: bigint, quotedOut: bigint, slippageBps: number) {
  return new TransactionInstruction({
    programId: new PublicKey(JUPITER_V6),
    keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
    data: Buffer.from(concat(JUPITER_ROUTE_DISC, new Uint8Array(4), u64(inAmount), u64(quotedOut), u16(slippageBps), new Uint8Array([0]))),
  });
}

export interface Sample {
  id: string;
  title: string;
  pitch: string; // what a scam site / sloppy dApp would call it
  expect: "high" | "medium" | "low";
  build: (payer: PublicKey) => TransactionInstruction[];
}

export const SAMPLES: Sample[] = [
  {
    id: "approve-unlimited",
    title: "Unlimited token approval",
    pitch: "What a fake “Claim airdrop” button often really asks for",
    expect: "high",
    build: (payer) => [createApproveInstruction(PLACEHOLDER_TOKEN_ACCOUNT, PLACEHOLDER_OTHER_PARTY, payer, U64_MAX)],
  },
  {
    id: "set-authority",
    title: "Token account handover",
    pitch: "Gives someone else ownership of a token account",
    expect: "high",
    build: (payer) => [
      createSetAuthorityInstruction(PLACEHOLDER_TOKEN_ACCOUNT, payer, AuthorityType.AccountOwner, PLACEHOLDER_OTHER_PARTY),
    ],
  },
  {
    id: "swap-loose-slippage",
    title: "Swap with 10% slippage",
    pitch: "Sandwich-bot bait: a bot can take up to 10% of the trade",
    expect: "high",
    build: (payer) => [jupiterRoute(payer, 1_000_000_000n, 150_000_000n, 1000)],
  },
  {
    id: "swap-tight-slippage",
    title: "Swap with 0.5% slippage",
    pitch: "Well-protected swap: the most a sandwich can take is 0.5%",
    expect: "medium",
    build: (payer) => [jupiterRoute(payer, 1_000_000_000n, 150_000_000n, 50)],
  },
  {
    id: "swap-no-limit",
    title: "Swap with no minimum out",
    pitch: "Accepts any price at all",
    expect: "high",
    build: (payer) => [
      new TransactionInstruction({
        programId: new PublicKey(RAYDIUM_AMM_V4),
        keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
        data: Buffer.from(concat(new Uint8Array([9]), u64(1_000_000_000n), u64(0n))),
      }),
    ],
  },
  {
    id: "safe-transfer",
    title: "Plain token transfer",
    pitch: "An ordinary transfer, for comparison",
    expect: "medium",
    build: (payer) => [createTransferInstruction(PLACEHOLDER_TOKEN_ACCOUNT, PLACEHOLDER_OTHER_PARTY, payer, 1_000_000)],
  },
];

export function buildSample(sample: Sample, payer: PublicKey, recentBlockhash: string): VersionedTransaction {
  const message = new TransactionMessage({ payerKey: payer, recentBlockhash, instructions: sample.build(payer) }).compileToV0Message();
  return new VersionedTransaction(message);
}
