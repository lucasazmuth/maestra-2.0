/**
 * Property-Based Tests for Reminder Notifications
 * Feature: maestra-pro-banner-and-benefits
 *
 * Tests the shouldGenerateReminders and capRecipients pure functions using fast-check.
 */

import * as fc from 'fast-check';
import {
  shouldGenerateReminders,
  capRecipients,
  AccountState,
  Recipient,
  MAX_RECIPIENTS_PER_REMINDER,
} from '../reminders';

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generator for arbitrary account states (isPro true or false).
 */
const arbitraryAccountState: fc.Arbitrary<AccountState> = fc.record({
  isPro: fc.boolean(),
});

/**
 * Generator for a single recipient with a UUID-like user_id.
 */
const arbitraryRecipient: fc.Arbitrary<Recipient> = fc.record({
  user_id: fc.uuid(),
});

/**
 * Generator for lists of recipients with arbitrary sizes (0 to 100+).
 */
const arbitraryRecipientList = (minLength = 0, maxLength = 100): fc.Arbitrary<Recipient[]> =>
  fc.array(arbitraryRecipient, { minLength, maxLength });

// ─── Property 7 ───────────────────────────────────────────────────────────────

/**
 * Property 7: Notificações geradas somente para contas PRO
 *
 * Para qualquer conta, se isPro === false, o sistema de geração de lembretes
 * SHALL não inserir novas notificações automatizadas para essa conta.
 * Conversely, if isPro === true, the system SHALL generate reminders.
 *
 * **Validates: Requirements 6.1, 6.2, 6.5**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 7: Notificações somente PRO', () => {
  test('shouldGenerateReminders returns false when isPro === false', () => {
    fc.assert(
      fc.property(
        // Generate account states that are NOT pro
        fc.constant({ isPro: false } as AccountState),
        (account) => {
          const result = shouldGenerateReminders(account);

          // Non-PRO accounts must NEVER have reminders generated
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('shouldGenerateReminders returns true when isPro === true', () => {
    fc.assert(
      fc.property(
        // Generate account states that ARE pro
        fc.constant({ isPro: true } as AccountState),
        (account) => {
          const result = shouldGenerateReminders(account);

          // PRO accounts must ALWAYS have reminders generated
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('reminders generated if and only if isPro === true for arbitrary account states', () => {
    fc.assert(
      fc.property(
        arbitraryAccountState,
        (account) => {
          const result = shouldGenerateReminders(account);

          // The result must equal isPro — reminders generated iff isPro
          expect(result).toBe(account.isPro);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 9 ───────────────────────────────────────────────────────────────

/**
 * Property 9: Limite de destinatários por lembrete
 *
 * Para qualquer lembrete gerado, o número de notificações inseridas (uma por
 * destinatário) SHALL ser no máximo 20, regardless of the input list size.
 *
 * **Validates: Requirements 6.1, 6.2, 6.5**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 9: Limite destinatários', () => {
  test('capRecipients always returns at most MAX_RECIPIENTS_PER_REMINDER (20) entries', () => {
    fc.assert(
      fc.property(
        // Generate lists with 0 to 100+ recipients
        arbitraryRecipientList(0, 150),
        (recipients) => {
          const capped = capRecipients(recipients);

          // The result must never exceed MAX_RECIPIENTS_PER_REMINDER
          expect(capped.length).toBeLessThanOrEqual(MAX_RECIPIENTS_PER_REMINDER);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('capRecipients preserves all recipients when list size <= 20', () => {
    fc.assert(
      fc.property(
        // Generate lists with at most 20 recipients
        arbitraryRecipientList(0, MAX_RECIPIENTS_PER_REMINDER),
        (recipients) => {
          const capped = capRecipients(recipients);

          // When input is within limit, ALL recipients should be preserved
          expect(capped.length).toBe(recipients.length);
          expect(capped).toEqual(recipients);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('capRecipients returns exactly 20 when list size > 20', () => {
    fc.assert(
      fc.property(
        // Generate lists with more than 20 recipients
        arbitraryRecipientList(MAX_RECIPIENTS_PER_REMINDER + 1, 150),
        (recipients) => {
          const capped = capRecipients(recipients);

          // When input exceeds limit, exactly MAX recipients are returned
          expect(capped.length).toBe(MAX_RECIPIENTS_PER_REMINDER);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('capRecipients preserves order (first N recipients kept)', () => {
    fc.assert(
      fc.property(
        // Generate lists of various sizes
        arbitraryRecipientList(1, 100),
        (recipients) => {
          const capped = capRecipients(recipients);

          // The capped result must be a prefix of the original list
          for (let i = 0; i < capped.length; i++) {
            expect(capped[i].user_id).toBe(recipients[i].user_id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('capRecipients returns empty array for empty input', () => {
    const result = capRecipients([]);
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });
});
