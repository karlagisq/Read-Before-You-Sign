//! scam-registry: an on-chain blocklist of flagged addresses.
//!
//! This is the Rust/Anchor piece of Read Before You Sign. It stores a
//! community list of addresses known to be scammy (drainer programs, fake
//! token mints, phishing recipients). The explainer app reads this list and
//! raises a flag when a transaction touches a known-bad address.
//!
//! Nothing here is deceptive or dangerous: it only records and reads public
//! labels. That's the whole point of the project — making risk visible.
//!
//! Anchor concepts you'll learn here:
//!   - declare_id! and #[program]       : defining a program and its entrypoints
//!   - PDAs (seeds + bump)              : deterministic addresses the program owns
//!   - #[account(init, ...)]            : creating accounts and paying rent
//!   - Context<T> and #[derive(Accounts)]: declaring what each instruction touches
//!   - account constraints (has_one, seeds): checks Anchor runs before your code

use anchor_lang::prelude::*;

// Placeholder ID. After your first `anchor build`, run `anchor keys sync`
// to replace this with the real program address.
declare_id!("11111111111111111111111111111111");

const MAX_LABEL_LEN: usize = 64;
const MAX_REASON_LEN: usize = 200;

#[program]
pub mod scam_registry {
    use super::*;

    /// Creates the registry once. Whoever calls this becomes the authority.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.count = 0;
        registry.bump = ctx.bumps.registry;
        Ok(())
    }

    /// Flags an address. Creates one PDA per flagged address, seeded by the
    /// address itself, so lookups are a single deterministic fetch.
    pub fn flag_address(
        ctx: Context<FlagAddress>,
        flagged: Pubkey,
        label: String,
        reason: String,
    ) -> Result<()> {
        require!(label.len() <= MAX_LABEL_LEN, RegistryError::LabelTooLong);
        require!(reason.len() <= MAX_REASON_LEN, RegistryError::ReasonTooLong);

        let entry = &mut ctx.accounts.entry;
        entry.flagged = flagged;
        entry.label = label;
        entry.reason = reason;
        entry.reporter = ctx.accounts.authority.key();
        entry.bump = ctx.bumps.entry;

        let registry = &mut ctx.accounts.registry;
        registry.count = registry.count.checked_add(1).ok_or(RegistryError::Overflow)?;
        Ok(())
    }

    /// Removes a flag (e.g. a false positive). Rent returns to the authority.
    pub fn unflag_address(ctx: Context<UnflagAddress>, _flagged: Pubkey) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.count = registry.count.saturating_sub(1);
        Ok(())
    }
}

#[account]
pub struct Registry {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
}

#[account]
pub struct FlaggedEntry {
    pub flagged: Pubkey,
    pub label: String,
    pub reason: String,
    pub reporter: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    // space = 8 (discriminator) + 32 (authority) + 8 (count) + 1 (bump)
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1,
        seeds = [b"registry"],
        bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(flagged: Pubkey)]
pub struct FlagAddress<'info> {
    #[account(mut, seeds = [b"registry"], bump = registry.bump, has_one = authority)]
    pub registry: Account<'info, Registry>,
    // One entry PDA per flagged address. 4-byte length prefix precedes each String.
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + (4 + MAX_LABEL_LEN) + (4 + MAX_REASON_LEN) + 32 + 1,
        seeds = [b"entry", flagged.as_ref()],
        bump
    )]
    pub entry: Account<'info, FlaggedEntry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(flagged: Pubkey)]
pub struct UnflagAddress<'info> {
    #[account(mut, seeds = [b"registry"], bump = registry.bump, has_one = authority)]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        close = authority,
        seeds = [b"entry", flagged.as_ref()],
        bump = entry.bump
    )]
    pub entry: Account<'info, FlaggedEntry>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[error_code]
pub enum RegistryError {
    #[msg("Label exceeds 64 characters")]
    LabelTooLong,
    #[msg("Reason exceeds 200 characters")]
    ReasonTooLong,
    #[msg("Registry count overflow")]
    Overflow,
}
