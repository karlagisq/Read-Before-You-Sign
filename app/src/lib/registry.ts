import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Reads the on-chain scam-registry and returns every flagged address.
 *
 * Each flagged address lives in its own `FlaggedEntry` PDA. Anchor prefixes
 * every account with an 8-byte discriminator = sha256("account:FlaggedEntry")[0..8],
 * so one getProgramAccounts call filtered on that prefix returns all entries.
 * Layout after the discriminator: flagged (32 bytes) | label | reason | reporter | bump.
 * We only need `flagged`, so we ask the RPC for just bytes 8..40.
 */

// sha256("account:FlaggedEntry")[0..8], precomputed (runs in the extension too).
const ENTRY_DISCRIMINATOR = Buffer.from("3e79dac122902bc3", "hex");

const CACHE_MS = 30_000;
let cache: { at: number; programId: string; addresses: Set<string> } | null = null;

export async function loadFlaggedAddresses(connection: Connection, registryProgramId?: string): Promise<Set<string>> {
  const programId = registryProgramId?.trim();
  if (!programId) return new Set(); // registry not configured: rule 5 just doesn't fire

  if (cache && cache.programId === programId && Date.now() - cache.at < CACHE_MS) {
    return cache.addresses;
  }

  try {
    const accounts = await connection.getProgramAccounts(new PublicKey(programId), {
      filters: [{ memcmp: { offset: 0, encoding: "base64", bytes: ENTRY_DISCRIMINATOR.toString("base64") } }],
      dataSlice: { offset: 8, length: 32 },
    });
    const addresses = new Set(accounts.map((a) => new PublicKey(a.account.data).toBase58()));
    cache = { at: Date.now(), programId, addresses };
    return addresses;
  } catch {
    // A registry outage must never block the check. Return the last good list if any.
    return cache?.programId === programId ? cache.addresses : new Set();
  }
}
