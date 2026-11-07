/**
 * Adds an address to the on-chain scam-registry (creating the registry first
 * if it doesn't exist yet). You must be the registry's authority — the wallet
 * that ran `initialize`.
 *
 * Usage (from /programs, after `anchor build` and `anchor deploy`):
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
 *     npx ts-node scripts/flag-address.ts <address> "<label>" "<reason>"
 *
 * Or: npm run flag -- <address> "<label>" "<reason>"
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const [address, label = "Flagged", reason = "Reported to Read Before You Sign"] = process.argv.slice(2);
  if (!address) {
    console.error('Usage: npx ts-node scripts/flag-address.ts <address> "<label>" "<reason>"');
    process.exit(1);
  }
  const flagged = new PublicKey(address); // throws on a malformed address

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = JSON.parse(readFileSync(join(__dirname, "../target/idl/scam_registry.json"), "utf8"));
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const authority = provider.wallet.publicKey;

  const [registry] = PublicKey.findProgramAddressSync([Buffer.from("registry")], program.programId);
  const [entry] = PublicKey.findProgramAddressSync([Buffer.from("entry"), flagged.toBuffer()], program.programId);

  if (!(await provider.connection.getAccountInfo(registry))) {
    console.log("Registry not found, initializing it with you as authority…");
    await program.methods.initialize().accountsPartial({ registry, authority }).rpc();
  }

  if (await provider.connection.getAccountInfo(entry)) {
    console.log(`${flagged.toBase58()} is already flagged.`);
    return;
  }

  const sig = await program.methods
    .flagAddress(flagged, label, reason)
    .accountsPartial({ registry, entry, authority })
    .rpc();
  console.log(`Flagged ${flagged.toBase58()} as "${label}". Tx: ${sig}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
