import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import type { DecodedInstruction } from "./types";
import {
  ATA_PROGRAM,
  COMPUTE_BUDGET_PROGRAM,
  KNOWN_PROGRAMS,
  SYSTEM_PROGRAM,
  TOKEN_PROGRAMS,
  U64_MAX,
} from "./programs";
import { decodeSwap, fmtPct } from "./swaps";

export const short = (a: string) => (a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

/** Accepts a base64 transaction (legacy or v0) as wallets/dApps produce it. */
export function parseTransaction(base64: string): VersionedTransaction {
  const bytes = Buffer.from(base64.trim(), "base64");
  return VersionedTransaction.deserialize(bytes);
}

/** Static account keys only. Address-lookup-table accounts are a TODO. */
export function accountKeys(tx: VersionedTransaction): string[] {
  return tx.message.staticAccountKeys.map((k) => k.toBase58());
}

export function decodeInstructions(tx: VersionedTransaction): DecodedInstruction[] {
  const keys = accountKeys(tx);
  return tx.message.compiledInstructions.map((ix, index) => {
    const programId = keys[ix.programIdIndex];
    const accounts = ix.accountKeyIndexes.map((i) => keys[i] ?? `lookup-table-account#${i}`);
    return decodeOne(index, programId, accounts, Buffer.from(ix.data));
  });
}

function readU64(data: Buffer, offset: number): bigint | null {
  return data.length >= offset + 8 ? data.readBigUInt64LE(offset) : null;
}

const fmtAmount = (n: bigint | null) =>
  n === null ? "?" : n === U64_MAX ? "UNLIMITED" : n.toString();

function decodeOne(index: number, programId: string, accounts: string[], data: Buffer): DecodedInstruction {
  const base = {
    index,
    programId,
    programName: KNOWN_PROGRAMS[programId] ?? "Unknown program",
    known: programId in KNOWN_PROGRAMS,
    accounts,
  };

  if (programId === SYSTEM_PROGRAM) return { ...base, ...decodeSystem(accounts, data) };
  if (TOKEN_PROGRAMS.has(programId)) return { ...base, ...decodeToken(accounts, data) };
  if (programId === ATA_PROGRAM)
    return { ...base, type: "CreateTokenAccount", summary: `Creates a token account for ${short(accounts[2] ?? "?")}`, details: {} };
  if (programId === COMPUTE_BUDGET_PROGRAM)
    return { ...base, type: "ComputeBudget", summary: "Sets compute limit / priority fee (harmless)", details: {} };

  const swap = decodeSwap(programId, data);
  if (swap) {
    const lim = swap.limit === null ? "?" : fmtAmount(swap.limit);
    const summary =
      swap.mode === "exact-in"
        ? `Swaps ${swap.amount} token units on ${swap.dex}, accepting at least ${lim} back`
        : `Swaps on ${swap.dex} for ${swap.amount} token units, paying at most ${lim}`;
    return {
      ...base,
      type: "Swap",
      summary: swap.slippageBps === null ? summary : `${summary} (slippage ${fmtPct(swap.slippageBps)})`,
      details: {
        dex: swap.dex,
        mode: swap.mode,
        amount: swap.amount.toString(),
        quoted: swap.quoted?.toString() ?? "",
        limit: swap.limit === null ? "" : fmtAmount(swap.limit),
        slippageBps: swap.slippageBps?.toString() ?? "",
      },
    };
  }
  if (base.known) {
    return { ...base, type: "Other", summary: `${base.programName} instruction (not decoded in detail)`, details: {} };
  }

  // Unknown program. For Anchor programs the first 8 bytes are a discriminator:
  // sha256("global:<instruction_name>")[0..8]. With the program's IDL you
  // could turn this into a real name. TODO: fetch IDLs on-chain.
  return {
    ...base,
    type: "unknown",
    summary: `Calls ${short(programId)}, a program this tool can't read`,
    details: {
      discriminator: data.subarray(0, 8).toString("hex"),
      dataBytes: String(data.length),
    },
  };
}

type Decoded = Pick<DecodedInstruction, "type" | "summary" | "details">;

function decodeSystem(a: string[], data: Buffer): Decoded {
  const kind = data.length >= 4 ? data.readUInt32LE(0) : -1;
  if (kind === 2) {
    const lamports = readU64(data, 4);
    return {
      type: "Transfer",
      summary: `Sends ${lamports === null ? "?" : Number(lamports) / 1e9} SOL from ${short(a[0])} to ${short(a[1])}`,
      details: { from: a[0], to: a[1], lamports: fmtAmount(lamports) },
    };
  }
  if (kind === 0) return { type: "CreateAccount", summary: `Creates new account ${short(a[1] ?? "?")}`, details: {} };
  return { type: `System#${kind}`, summary: "System Program instruction", details: {} };
}

const AUTHORITY_TYPES = ["MintTokens", "FreezeAccount", "AccountOwner", "CloseAccount"];

function decodeToken(a: string[], data: Buffer): Decoded {
  switch (data[0]) {
    case 3: {
      const amt = readU64(data, 1);
      return {
        type: "Transfer",
        summary: `Moves ${fmtAmount(amt)} token units from ${short(a[0])} to ${short(a[1])}`,
        details: { source: a[0], destination: a[1], owner: a[2], amount: fmtAmount(amt) },
      };
    }
    case 12: {
      const amt = readU64(data, 1);
      return {
        type: "Transfer",
        summary: `Moves ${fmtAmount(amt)} token units from ${short(a[0])} to ${short(a[2])}`,
        details: { source: a[0], mint: a[1], destination: a[2], owner: a[3], amount: fmtAmount(amt), decimals: String(data[9]) },
      };
    }
    case 4: {
      const amt = readU64(data, 1);
      return {
        type: "Approve",
        summary: `Lets ${short(a[1])} spend ${fmtAmount(amt)} units from ${short(a[0])}`,
        details: { tokenAccount: a[0], delegate: a[1], owner: a[2], amount: fmtAmount(amt) },
      };
    }
    case 13: {
      const amt = readU64(data, 1);
      return {
        type: "Approve",
        summary: `Lets ${short(a[2])} spend ${fmtAmount(amt)} units from ${short(a[0])}`,
        details: { tokenAccount: a[0], mint: a[1], delegate: a[2], owner: a[3], amount: fmtAmount(amt) },
      };
    }
    case 6: {
      const authorityType = AUTHORITY_TYPES[data[1]] ?? `type ${data[1]}`;
      const newAuthority = data[2] === 1 && data.length >= 35 ? new PublicKey(data.subarray(3, 35)).toBase58() : "none";
      return {
        type: "SetAuthority",
        summary: `Changes ${authorityType} of ${short(a[0])} to ${newAuthority === "none" ? "nobody" : short(newAuthority)}`,
        details: { account: a[0], currentAuthority: a[1], authorityType, newAuthority },
      };
    }
    case 9:
      return {
        type: "CloseAccount",
        summary: `Closes token account ${short(a[0])}, leftover SOL goes to ${short(a[1])}`,
        details: { account: a[0], destination: a[1], owner: a[2] },
      };
    default:
      return { type: `Token#${data[0]}`, summary: "Token program instruction", details: {} };
  }
}
