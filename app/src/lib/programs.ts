// Well-known Solana program addresses. Anything not in this list is
// "unknown" to the decoder, which is itself a risk signal.

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export const KNOWN_PROGRAMS: Record<string, string> = {
  [SYSTEM_PROGRAM]: "System Program",
  [TOKEN_PROGRAM]: "SPL Token",
  [TOKEN_2022_PROGRAM]: "Token-2022",
  [ATA_PROGRAM]: "Associated Token Account",
  [COMPUTE_BUDGET_PROGRAM]: "Compute Budget",
  [MEMO_PROGRAM]: "Memo",
  // TODO: add popular programs (Jupiter, Raydium, Metaplex...) so they read as "known".
};

export const TOKEN_PROGRAMS = new Set([TOKEN_PROGRAM, TOKEN_2022_PROGRAM]);

export const U64_MAX = 18446744073709551615n;
