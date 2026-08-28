/**
 * Pure utility functions for the generate-reminders system.
 *
 * Extracted from `supabase/functions/generate-reminders/index.ts` to allow
 * property-based testing of core logic without DB dependencies.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountState {
  isPro: boolean;
}

export interface Recipient {
  user_id: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max recipients (owner + collaborators) per reminder */
export const MAX_RECIPIENTS_PER_REMINDER = 20;

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Determines whether reminders should be generated for a given account state.
 *
 * Reminders are ONLY generated when the account is PRO (isPro === true).
 * Non-PRO accounts never receive automated reminders.
 */
export function shouldGenerateReminders(account: AccountState): boolean {
  return account.isPro === true;
}

/**
 * Caps a list of recipients to the maximum allowed per reminder (20).
 *
 * The function takes an arbitrary list of recipients and returns at most
 * MAX_RECIPIENTS_PER_REMINDER entries, preserving order (first N recipients kept).
 */
export function capRecipients(recipients: Recipient[]): Recipient[] {
  return recipients.slice(0, MAX_RECIPIENTS_PER_REMINDER);
}
