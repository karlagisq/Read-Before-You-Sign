import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { ScamRegistry } from "../target/types/scam_registry";

describe("scam-registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ScamRegistry as Program<ScamRegistry>;
  const authority = (provider.wallet as anchor.Wallet).publicKey;

  const [registry] = PublicKey.findProgramAddressSync([Buffer.from("registry")], program.programId);

  it("initializes the registry", async () => {
    await program.methods.initialize().accountsPartial({ registry, authority }).rpc();
    const state = await program.account.registry.fetch(registry);
    expect(state.count.toNumber()).to.equal(0);
    expect(state.authority.toBase58()).to.equal(authority.toBase58());
  });

  it("flags an address and can read it back", async () => {
    const bad = Keypair.generate().publicKey;
    const [entry] = PublicKey.findProgramAddressSync(
      [Buffer.from("entry"), bad.toBuffer()],
      program.programId
    );

    await program.methods
      .flagAddress(bad, "Known drainer", "Hides an unlimited Approve inside a fake airdrop")
      .accountsPartial({ registry, entry, authority })
      .rpc();

    const saved = await program.account.flaggedEntry.fetch(entry);
    expect(saved.flagged.toBase58()).to.equal(bad.toBase58());
    expect(saved.label).to.equal("Known drainer");

    const state = await program.account.registry.fetch(registry);
    expect(state.count.toNumber()).to.equal(1);
  });
});
