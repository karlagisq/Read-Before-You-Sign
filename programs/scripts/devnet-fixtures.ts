/**
 * LIVE devnet demo transactions, built on REAL accounts you own, so the dry
 * run succeeds and Read Before You Sign shows what would actually change
 * (not just "failed to simulate" like the placeholder samples).
 *
 * What it does (devnet only, test tokens, ~0.01 devnet SOL the first time):
 *   1. Uses your devnet wallet (~/.config/solana/id.json, or --keypair <path>).
 *   2. Creates a test token "RBYS-TEST", a token account for you, and mints
 *      you 1,000 test tokens. Also creates a recipient account for the safe
 *      transfer. Reused on later runs (saved in .devnet-fixtures.json).
 *   3. Prints openly-labeled sample transactions, UNSIGNED. Nothing here
 *      signs or sends them. The "other party" is a random address nobody holds.
 *   4. Writes app/public/devnet-fixtures.json so the Demo dApp can use them.
 *
 * Usage (from /programs):
 *   npx ts-node scripts/devnet-fixtures.ts
 *   npx ts-node scripts/devnet-fixtures.ts --keypair ~/my-devnet.json
 *
 * Need devnet SOL? https://faucet.solana.com (command-line airdrops are off on devnet).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  AuthorityType,
  createApproveInstruction,
  createMint,
  createSetAuthorityInstruction,
  createTransferInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

const RPC = "https://api.devnet.solana.com";
const U64_MAX = 18446744073709551615n;
const DECIMALS = 6;
const STATE = join(__dirname, "..", ".devnet-fixtures.json");
const OUT = join(__dirname, "..", "..", "app", "public", "devnet-fixtures.json");

interface State {
  wallet: string;
  mint: string;
  tokenAccount: string;
  recipientOwner: string;
  recipientAccount: string;
  otherParty: string; // stands in for a scammer: random, nobody holds its key
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function loadWallet(): Keypair {
  const path = (arg("--keypair") ?? join(homedir(), ".config", "solana", "id.json")).replace(/^~/, homedir());
  if (!existsSync(path)) {
    console.error(`No wallet file at ${path}. Create one with: solana-keygen new`);
    process.exit(1);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

async function exists(conn: Connection, address: string) {
  return (await conn.getAccountInfo(new PublicKey(address))) !== null;
}

async function setup(conn: Connection, wallet: Keypair): Promise<State> {
  if (existsSync(STATE)) {
    const s = JSON.parse(readFileSync(STATE, "utf8")) as State;
    if (s.wallet === wallet.publicKey.toBase58() && (await exists(conn, s.tokenAccount)) && (await exists(conn, s.recipientAccount))) {
      console.log("Reusing your test token and accounts from last time.");
      return s;
    }
  }
  const sol = (await conn.getBalance(wallet.publicKey)) / LAMPORTS_PER_SOL;
  if (sol < 0.02) {
    console.error(`\nYour devnet wallet ${wallet.publicKey.toBase58()} has ${sol} SOL; setup needs about 0.01.`);
    console.error("Get free devnet SOL at https://faucet.solana.com (paste that address, pick devnet), then run this again.\n");
    process.exit(1);
  }
  console.log("Creating a test token and accounts on devnet (one-time, ~0.01 devnet SOL)…");
  const mint = await createMint(conn, wallet, wallet.publicKey, null, DECIMALS);
  const mine = await getOrCreateAssociatedTokenAccount(conn, wallet, mint, wallet.publicKey);
  await mintTo(conn, wallet, mint, mine.address, wallet, 1_000n * 10n ** BigInt(DECIMALS));
  const recipientOwner = Keypair.generate().publicKey;
  const theirs = await getOrCreateAssociatedTokenAccount(conn, wallet, mint, recipientOwner);
  const s: State = {
    wallet: wallet.publicKey.toBase58(),
    mint: mint.toBase58(),
    tokenAccount: mine.address.toBase58(),
    recipientOwner: recipientOwner.toBase58(),
    recipientAccount: theirs.address.toBase58(),
    otherParty: Keypair.generate().publicKey.toBase58(),
  };
  writeFileSync(STATE, JSON.stringify(s, null, 2) + "\n");
  return s;
}

function build(conn: Connection, payer: PublicKey, blockhash: string, ixs: TransactionInstruction[]) {
  const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const wallet = loadWallet();
  const s = await setup(conn, wallet);
  const me = new PublicKey(s.wallet);
  const mine = new PublicKey(s.tokenAccount);
  const other = new PublicKey(s.otherParty);
  const { blockhash } = await conn.getLatestBlockhash();
  const bal = await getAccount(conn, mine);

  const samples = [
    {
      id: "live-approve-unlimited",
      title: "LIVE: unlimited token approval",
      pitch: "What a fake “claim airdrop” button often really asks for. The dry run shows the delegate being set on your real token account.",
      expect: "high",
      base64: build(conn, me, blockhash, [createApproveInstruction(mine, other, me, U64_MAX)]),
    },
    {
      id: "live-set-authority",
      title: "LIVE: token account handover",
      pitch: "Gives someone else ownership of your real token account.",
      expect: "high",
      base64: build(conn, me, blockhash, [createSetAuthorityInstruction(mine, me, AuthorityType.AccountOwner, other)]),
    },
    {
      id: "live-safe-transfer",
      title: "LIVE: send 5 test tokens",
      pitch: "An ordinary transfer. The dry run succeeds, so it should come back “Looks okay” with the balance change.",
      expect: "low",
      base64: build(conn, me, blockhash, [createTransferInstruction(mine, new PublicKey(s.recipientAccount), me, 5n * 10n ** BigInt(DECIMALS))]),
    },
    {
      id: "live-sol-transfer",
      title: "LIVE: send 0.001 SOL",
      pitch: "A plain SOL payment, for comparison.",
      expect: "low",
      base64: build(conn, me, blockhash, [SystemProgram.transfer({ fromPubkey: me, toPubkey: new PublicKey(s.recipientOwner), lamports: 1_000_000 })]),
    },
  ];

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ cluster: "devnet", wallet: s.wallet, mint: s.mint, otherParty: s.otherParty, generatedAt: new Date().toISOString(), samples }, null, 2) + "\n"
  );

  console.log(`\nWallet ${s.wallet} · test token ${s.mint} · you hold ${Number(bal.amount) / 10 ** DECIMALS} RBYS-TEST`);
  console.log(`"Other party" (stands in for a scammer, nobody holds its key): ${s.otherParty}\n`);
  for (const x of samples) console.log(`── ${x.title} (expect ${x.expect.toUpperCase()})\n${x.base64}\n`);
  console.log(`Saved for the Demo dApp: app/public/devnet-fixtures.json`);
  console.log(`Paste any line above into the web checker, pipe it into rbys, or open /demo → "Live on devnet".`);
  console.log(`\nBlocklist demo: flag the other party, then check the approval again:`);
  console.log(`  ANCHOR_PROVIDER_URL=${RPC} ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/flag-address.ts ${s.otherParty} "Demo scammer" "Live demo"`);
  console.log(`\nThese are UNSIGNED. Nothing was signed or sent except the one-time setup above.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
