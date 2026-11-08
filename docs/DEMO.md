# Demo guide: Read Before You Sign

A 2-minute recording that shows **live** work on Solana devnet, plus a
checklist to get it submitted on time.

## ⏰ Deadlines (Sunday, Nov 8)

| ET | PT | What |
| --- | --- | --- |
| **10:00 AM** | 7:00 AM | **Initial submission** due on MLH Challenges (submit something, even rough) |
| **11:45 AM** | 8:45 AM | **Hacking ends: final submission** due |
| 12:00 PM | 9:00 AM | Closing ceremony (MLH Blue) |

Submit a working draft before 10:00 ET, then polish the video and README
until 11:45 ET.

## 🎛️ Set up before you hit record (10 min)

1. **Devnet SOL** in your CLI wallet: `solana balance`. If it's low, use
   https://faucet.solana.com (choose devnet).
2. **Live samples:** `cd programs && npm run devnet-fixtures`
   Copy the `flag-address.ts` command it prints at the end; you'll use it on camera.
3. **App:** `cd app && npm run dev` → open http://localhost:3000/demo
4. **Extension:** loaded, pinned, popup set to **Devnet**. Smoother recording:
   paste a free Helius **devnet** RPC URL under **Advanced** (the public devnet
   RPC sometimes rate-limits).
5. Do one full practice run. The first dry run of a session is the slowest.
6. Record at 1280×800, browser zoom 100%, notifications off.

## 🎬 The script (2:00)

| Time | Show | Say |
| --- | --- | --- |
| **0:00–0:15** · Hook | The Demo dApp page | "Every Solana wallet popup asks you to trust a button. Drainer sites exploit that: the button says *Claim airdrop*, but the transaction says *give a stranger unlimited access to your tokens*." |
| **0:15–0:45** · Catch a drainer | **Use demo wallet** → *Live on devnet* → **Unlimited token approval** | "This is Read Before You Sign, a Chrome extension. It stepped in *before* the wallet opened and ran the transaction on Solana devnet. Here's what would really change: a new spender with **unlimited** access to my real token account. High risk, and it tells me what to do. **Continue** is locked until I confirm I understand." → click **Reject**. "The site just gets a normal rejection." |
| **0:45–1:00** · No crying wolf | **Send 5 test tokens** | "A normal transfer comes back *Looks okay*, with the exact balance changes from the dry run." |
| **1:00–1:25** · Sandwich exposure | **Swap with 10% slippage** | "Swaps are where sandwich bots hunt. A bot can only take as much as your slippage allows, and that's written in the transaction. Here: up to 10%. You'd accept 135 instead of 150. And here's how to protect yourself: tight slippage, private sending, limit orders." Then show the 0.5% one: "Tight slippage: the most a bot could take is 0.5%." |
| **1:25–1:45** · On-chain registry | Terminal: run the `flag-address.ts` command, then sign the approval again | "The blocklist lives on Solana: an Anchor program I wrote, one PDA per flagged address. I just flagged this address, and the check now says it *touches an address on the community blocklist*, read live from the chain." |
| **1:45–2:00** · Close | Back to the panel | "Solana does the detection: a real dry run and an on-chain registry. AI only explains, and it can't override a warning. Read Before You Sign: know what you sign, before you sign." |

**If something misbehaves live:** the RPC can rate-limit. Wait 10 seconds and
click again, or switch the popup's RPC to your Helius URL. The panel never
pretends: it says "couldn't check" instead of guessing.

## 📝 Submission form drafts

**Tagline:** Know what you sign, before you sign: a Solana wallet guard that
dry-runs every transaction and tells you what to do about the risky parts.

**Inspiration:** Wallet popups ask people to trust a button. Drainer sites and
sandwich bots profit from what the popup doesn't explain. We wanted a seatbelt
that reads the transaction for you, before you sign.

**What it does:** A Chrome extension that steps in between any Solana site and
your wallet. It dry-runs the transaction on Solana, shows exactly what would
change, flags unlimited approvals, account handovers, blocklisted addresses and
sandwich-prone swaps, and gives plain steps to stay safe. It also comes as a
web checker and a CLI, with an on-chain scam registry written in Rust/Anchor.

**How we built it:** TypeScript analyzer (decode → simulate → rules → guidance)
shared by a Manifest V3 extension, a Next.js app and a CLI. `simulateTransaction`
with before/after account diffs. Anchor program with PDAs for the registry,
deployed to devnet. Claude rewords findings without changing the verdict.
Designed in Figma with tokens synced to code.

**Challenges:** Making the extension work with every wallet (Wallet Standard
plus injected providers), keeping the panel tamper-resistant, keeping
pending transactions private (sandwich bots love early visibility), and
building real devnet fixtures so the demo shows live results, not mock-ups.

**Accomplishments:** A self-contained extension (no server), live dry runs
with exact changes, and advice under every warning.

**What we learned:** How Solana transactions, SPL token accounts and Anchor
PDAs work under the hood; how MEV and sandwich attacks really happen on
Solana; and why AI belongs in the explaining, not the deciding.

**What's next:** Approvals scanner with one-click revoke, lookup-table
support, more DEX decoders, dollar values, and a Chrome Web Store release.

**Track:** AI Track. It matches *"security tools that explain what a
transaction will do or flag risky programs, tokens and wallets before a user
signs."* Also automatically entered for Top 3 Overall.

## ✅ Final checklist

- [ ] Repo public, README renders (logo + screenshots)
- [ ] Demo video uploaded (YouTube unlisted or Loom), link in README + submission
- [ ] Extension zip attached to a GitHub Release
- [ ] Initial submission in by **10:00 AM ET**
- [ ] Final submission in by **11:45 AM ET**
