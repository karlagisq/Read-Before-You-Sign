import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import type { BalanceChange, DelegateChange, OwnerChange, SimulationResult } from "./types";
import { TOKEN_PROGRAMS } from "./programs";
import { accountKeys } from "./decode";

const MAX_WATCHED = 24;

interface TokenState {
  mint: string;
  owner: string;
  amount: bigint;
  delegate: string | null;
  delegatedAmount: bigint;
}

/**
 * SPL token account layout (first 165 bytes; Token-2022 shares this prefix):
 *   0..32   mint
 *   32..64  owner
 *   64..72  amount (u64 LE)
 *   72..76  delegate COption tag (1 = Some)
 *   76..108 delegate pubkey
 *   108     state
 *   121..129 delegated_amount (u64 LE)
 */
function parseTokenState(data: Buffer, programOwner: string): TokenState | null {
  if (!TOKEN_PROGRAMS.has(programOwner) || data.length < 165) return null;
  const hasDelegate = data.readUInt32LE(72) === 1;
  return {
    mint: new PublicKey(data.subarray(0, 32)).toBase58(),
    owner: new PublicKey(data.subarray(32, 64)).toBase58(),
    amount: data.readBigUInt64LE(64),
    delegate: hasDelegate ? new PublicKey(data.subarray(76, 108)).toBase58() : null,
    delegatedAmount: data.readBigUInt64LE(121),
  };
}

/**
 * Dry-runs the transaction and diffs each writable account's state before vs.
 * after. The diff is what matters: it reflects what the transaction REALLY
 * does, including effects buried in instructions a static decoder might miss.
 */
export async function simulate(
  connection: Connection,
  tx: VersionedTransaction
): Promise<SimulationResult> {
  const keys = accountKeys(tx).map((k) => new PublicKey(k));

  // Writable static accounts, capped so simulateTransaction stays cheap.
  const header = tx.message.header;
  const writable: PublicKey[] = [];
  keys.forEach((k, i) => {
    const numStatic = keys.length;
    const isWritable =
      i < header.numRequiredSignatures - header.numReadonlySignedAccounts ||
      (i >= header.numRequiredSignatures &&
        i < numStatic - header.numReadonlyUnsignedAccounts);
    if (isWritable) writable.push(k);
  });
  const watched = writable.slice(0, MAX_WATCHED);

  const before = await connection.getMultipleAccountsInfo(watched);

  const sim = await connection.simulateTransaction(tx, {
    replaceRecentBlockhash: true,
    sigVerify: false,
    accounts: { encoding: "base64", addresses: watched.map((k) => k.toBase58()) },
  });

  const v = sim.value;
  const balanceChanges: BalanceChange[] = [];
  const delegateChanges: DelegateChange[] = [];
  const ownerChanges: OwnerChange[] = [];

  (v.accounts ?? []).forEach((afterAcc, i) => {
    const addr = watched[i].toBase58();
    const beforeAcc = before[i];

    const lamBefore = BigInt(beforeAcc?.lamports ?? 0);
    const lamAfter = BigInt(afterAcc?.lamports ?? 0);
    if (lamBefore !== lamAfter) {
      balanceChanges.push({
        address: addr,
        kind: "sol",
        before: lamBefore.toString(),
        after: lamAfter.toString(),
        delta: (lamAfter - lamBefore).toString(),
      });
    }

    const beforeData = beforeAcc?.data ? Buffer.from(beforeAcc.data) : Buffer.alloc(0);
    const afterData = afterAcc?.data ? Buffer.from(afterAcc.data[0], "base64") : Buffer.alloc(0);
    const beforeOwner = beforeAcc?.owner?.toBase58() ?? "";
    const afterOwner = afterAcc?.owner ?? "";

    const bt = parseTokenState(beforeData, beforeOwner);
    const at = parseTokenState(afterData, afterOwner);
    if (bt && at) {
      if (bt.amount !== at.amount) {
        balanceChanges.push({
          address: addr,
          kind: "token",
          mint: at.mint,
          owner: at.owner,
          before: bt.amount.toString(),
          after: at.amount.toString(),
          delta: (at.amount - bt.amount).toString(),
        });
      }
      if (bt.delegate !== at.delegate || bt.delegatedAmount !== at.delegatedAmount) {
        delegateChanges.push({
          tokenAccount: addr,
          mint: at.mint,
          owner: at.owner,
          delegateBefore: bt.delegate,
          delegateAfter: at.delegate,
          delegatedAmountAfter: at.delegatedAmount.toString(),
        });
      }
      if (bt.owner !== at.owner) {
        ownerChanges.push({ tokenAccount: addr, before: bt.owner, after: at.owner });
      }
    }
  });

  return {
    ok: v.err === null,
    error: v.err ? JSON.stringify(v.err) : null,
    logs: v.logs ?? [],
    unitsConsumed: v.unitsConsumed ?? null,
    balanceChanges,
    delegateChanges,
    ownerChanges,
  };
}
