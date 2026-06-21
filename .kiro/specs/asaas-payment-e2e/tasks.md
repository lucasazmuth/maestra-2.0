# Implementation Plan: Asaas Payment E2E Hardening

## Overview

Este plano implementa o hardening do fluxo de pagamento E2E com o gateway Asaas. O código base já existe — o foco é corrigir 7 gaps identificados no design, adicionar testes property-based para as 6 propriedades de correção, e garantir robustez end-to-end. Todas as tarefas usam TypeScript, Jest, e fast-check.

## Tasks

- [x] 1. Fix webhook grace period and status mapping
  - [x] 1.1 Fix grace period duration in asaas-webhook Edge Function
    - Change `grace_period_ends_at` calculation from `now + 72h` to `now + 7 days` in `supabase/functions/asaas-webhook/index.ts`
    - Ensure PAYMENT_OVERDUE event correctly sets status to `'overdue'` and calculates grace period as 7 days from event date
    - _Requirements: 5.2_

  - [x] 1.2 Verify webhook status mapping completeness
    - Ensure PAYMENT_CONFIRMED and PAYMENT_RECEIVED → `status: 'active'`
    - Ensure PAYMENT_DELETED → update `asaas_payments` to `status: 'deleted'`
    - Ensure SUBSCRIPTION_DELETED and SUBSCRIPTION_INACTIVATED → `status: 'cancelled'`
    - Ensure idempotency check on `event_id` returns 200 without reprocessing
    - _Requirements: 5.1, 5.3, 5.4, 5.7, 5.8_

  - [x]* 1.3 Write property test for webhook event status mapping (Property 4)
    - **Property 4: Webhook Event Status Mapping**
    - Generate webhook payloads with various `event_type` values and verify correct status transitions
    - Use fast-check arbitraries to generate valid event payloads
    - File: `src/hooks/__tests__/webhookStatusMapping.property.test.ts`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x]* 1.4 Write property test for webhook idempotency (Property 5)
    - **Property 5: Webhook Idempotency**
    - Process same event_id twice, verify second processing returns 200 without state change
    - Mock DB layer to verify no duplicate writes occur
    - File: `src/hooks/__tests__/webhookIdempotency.property.test.ts`
    - **Validates: Requirements 5.7, 5.8**

- [x] 2. Fix subscription status Edge Function response
  - [x] 2.1 Update asaas-subscription-status to return status 'none' with HTTP 200
    - Modify `supabase/functions/asaas-subscription-status/index.ts` to return `{ status: 'none', asaasCustomerId: null, asaasSubscriptionId: null, nextDueDate: null, value: null, gracePeriodEndsAt: null }` when no subscription exists
    - Change from current 404 response to 200 with `status: 'none'`
    - _Requirements: 6.4_

  - [x]* 2.2 Write unit tests for asaas-subscription-status responses
    - Test happy path: user with active subscription returns correct fields
    - Test no subscription: returns status 'none' with null fields
    - Test overdue with grace period: returns correct gracePeriodEndsAt
    - _Requirements: 6.3, 6.4_

- [x] 3. Fix polling resilience in subscription slice
  - [x] 3.1 Add consecutive error counter to pollPaymentStatus thunk
    - Modify `src/store/slices/subscription.ts` to track consecutive polling errors
    - On single network error: skip iteration, continue on next 5s interval without resetting timer
    - On 3 consecutive errors: reject the thunk with a connectivity error message in Portuguese
    - Reset error counter on any successful poll response
    - _Requirements: 9.3, 9.4_

  - [x] 3.2 Update Payment page to handle polling failure states
    - In `src/pages/Payment/index.tsx`, handle the rejected polling state
    - Display connectivity error message with retry button when 3 consecutive errors occur
    - On retry, reset error counter and restart polling
    - _Requirements: 4.8, 9.4_

  - [x]* 3.3 Write unit tests for polling resilience logic
    - Test single error is skipped without user-facing error
    - Test 3 consecutive errors stops polling and surfaces error
    - Test successful response resets error counter
    - _Requirements: 9.3, 9.4_

- [x] 4. Fix createSubscription thunk response contract alignment
  - [x] 4.1 Align createSubscription thunk with Edge Function response shape
    - In `src/store/slices/subscription.ts`, update the `createSubscription` thunk to correctly extract `pixData` from the Edge Function response
    - The Edge Function returns `{ pixData: { qrCode, copyPaste, expiresAt } }` but the thunk expects `pixQrCode`/`pixCopyPaste`/`expiresAt` at root level — align to actual response shape
    - Map response to slice state: `pixData.qrCodeImage = response.pixData.qrCode`, `pixData.copyPasteText = response.pixData.copyPaste`, `pixData.expiresAt = response.pixData.expiresAt`
    - _Requirements: 2.2, 2.3_

  - [x] 4.2 Add PIX data null guard in createSubscription fulfilled reducer
    - In the `createSubscription.fulfilled` reducer, check if `pixData.qrCode` is null/absent
    - If null: store error message "Não foi possível gerar o QR Code PIX. Tente novamente." in `state.error`, do NOT set `pixData`, do NOT navigate to Payment page
    - _Requirements: 9.5_

  - [x] 4.3 Add credit card flow branch in asaas-create-subscription Edge Function
    - In `supabase/functions/asaas-create-subscription/index.ts`, add conditional logic for `billingType: 'CREDIT_CARD'`
    - For CC: create subscription with immediate charge, return `{ status: 'active' }` on success or error details on decline
    - For PIX: maintain existing logic returning pixData
    - Read plan value from `asaas_plan_config` table for both flows
    - _Requirements: 3.1, 3.2, 3.3, 2.5_

  - [x]* 4.4 Write unit tests for createSubscription thunk
    - Test PIX happy path: correct pixData extraction and navigation
    - Test PIX with null qrCode: error stored, no navigation
    - Test CC happy path: status set to active, navigate to success
    - Test CC decline: error stored, no navigation
    - _Requirements: 2.3, 3.2, 3.3, 9.5_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Fix CPF/CNPJ validation and credit card validation
  - [x] 6.1 Verify CPF/CNPJ validation functions handle edge cases
    - In `src/pages/Subscription/index.tsx`, ensure `isValidCpf` rejects all-same-digit strings (e.g., "11111111111")
    - Ensure `isValidCnpj` correctly implements both check digits of the CNPJ algorithm
    - Verify the same validation logic exists in `supabase/functions/asaas-create-customer/index.ts` for server-side validation
    - _Requirements: 1.3_

  - [x]* 6.2 Write property test for CPF/CNPJ validation (Property 1)
    - **Property 1: CPF/CNPJ Validation Correctness**
    - Generate valid CPFs by computing check digits from random 9-digit bases, verify `isValidCpf` returns true
    - Generate invalid CPFs by flipping digits, verify `isValidCpf` returns false
    - Generate all-same-digit CPFs, verify returns false
    - Analogous generators for CNPJ (12-digit base + 2 check digits)
    - File: `src/pages/__tests__/cpfCnpjValidation.property.test.ts`
    - **Validates: Requirements 1.3**

  - [x] 6.3 Verify credit card field validation completeness
    - In `src/pages/Subscription/index.tsx`, ensure `validateForm` checks: number 13–19 digits, holderName 3–100 chars after trim, expiry 4 digits MMYY, CVV 3–4 digits, phone 10–11 digits, CEP 8 digits
    - Ensure submit is disabled when any field fails validation
    - Ensure error indicators are shown adjacent to each invalid field
    - _Requirements: 3.4, 3.5_

  - [x]* 6.4 Write property test for credit card field validation (Property 2)
    - **Property 2: Credit Card Field Validation Correctness**
    - Generate valid/invalid combinations of CC fields using fast-check arbitraries
    - Verify `validateForm` returns null for all-valid inputs and non-null error for any invalid field
    - File: `src/pages/__tests__/creditCardValidation.property.test.ts`
    - **Validates: Requirements 3.4, 3.5**

- [x] 7. Fix countdown formatting and StatusBanner initialized check
  - [x] 7.1 Verify formatCountdown handles edge cases
    - In `src/pages/Payment/index.tsx`, ensure `formatCountdown` returns "00:00" for values ≤ 0
    - Ensure zero-padding for both minutes and seconds
    - _Requirements: 4.3_

  - [x]* 7.2 Write property test for countdown timer formatting (Property 3)
    - **Property 3: Countdown Timer Formatting**
    - Generate non-negative integers, verify output matches `mm:ss` format with correct math
    - Generate negative integers and zero, verify output is "00:00"
    - File: `src/pages/__tests__/countdownFormat.property.test.ts`
    - **Validates: Requirements 4.3**

  - [x] 7.3 Verify useStatusBanner checks initialized state
    - Ensure `useStatusBanner` hook returns `null` when `state.subscription.initialized === false`
    - Ensure banner is not rendered on `/assinatura` or `/pagamento` routes
    - Ensure banner is not rendered when `PAYWALL_DISABLED === true`
    - _Requirements: 8.4, 8.6, 8.7_

  - [x]* 7.4 Write unit tests for useStatusBanner logic
    - Test returns null when not initialized
    - Test returns null on subscription/payment routes
    - Test returns null when PAYWALL_DISABLED
    - Test correct variant for each status (pending → info, overdue → warning, none/cancelled → promo)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7_

- [x] 8. Implement entitlements derivation hardening
  - [x] 8.1 Verify deriveEntitlements logic in useEntitlements hook
    - In `src/hooks/useEntitlements.ts`, verify: `plan: 'pro'` when PAYWALL_DISABLED is true, OR status === 'active', OR (status === 'overdue' AND now ≤ gracePeriodEndsAt)
    - Verify: `plan: 'free'` for all other cases including 'none', 'cancelled', 'pending', or overdue past grace period
    - Verify: when plan is 'pro', all feature flags are true and limits are Infinity
    - _Requirements: 6.6, 10.2_

  - [x]* 8.2 Write property test for entitlements derivation (Property 6)
    - **Property 6: Entitlements Derivation Correctness**
    - Generate all status values × gracePeriodEndsAt timestamps × current time
    - Verify plan derivation matches the specification rules
    - Include PAYWALL_DISABLED scenarios
    - File: `src/hooks/__tests__/entitlementsDerivation.property.test.ts`
    - **Validates: Requirements 6.6, 10.2**

  - [x]* 8.3 Write unit tests for useEntitlements edge cases
    - Test gracePeriodEndsAt exactly at current time (boundary)
    - Test null gracePeriodEndsAt with overdue status → free
    - Test PAYWALL_DISABLED overrides any status to pro
    - _Requirements: 6.6, 10.2_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire remaining E2E flow integration
  - [x] 10.1 Ensure Payment page redirect guard works correctly
    - In `src/pages/Payment/index.tsx`, verify redirect to `/assinatura` within 1 second when `pixData` is missing `qrCodeImage` or `expirationDate`
    - Ensure redirect does NOT occur when valid pixData is present
    - _Requirements: 9.6, 4.2_

  - [x] 10.2 Ensure error dismissal clears Redux state
    - In `src/pages/Subscription/index.tsx`, ensure Alert component's `onClose` dispatches action to clear `state.subscription.error`
    - Ensure error messages are in Portuguese and ≤ 200 characters
    - _Requirements: 9.1, 9.2_

  - [x] 10.3 Ensure fetchSubscriptionStatus respects PAYWALL_DISABLED
    - In Layout component, verify `fetchSubscriptionStatus` is NOT dispatched when `PAYWALL_DISABLED === true`
    - Verify it IS dispatched on mount when PAYWALL_DISABLED is false and user is authenticated
    - _Requirements: 10.1, 6.1_

  - [x]* 10.4 Write integration tests for E2E flow
    - Test PIX flow: createCustomer → createSubscription → poll → active
    - Test CC flow: createCustomer → createSubscription → immediate active
    - Test cancellation flow: cancel → status updated
    - Mock Edge Functions at network boundary
    - _Requirements: 2.3, 3.2, 7.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- This is a hardening phase — most code exists, tasks focus on fixing gaps and adding robustness
- All test files follow existing project convention: `src/hooks/__tests__/` and `src/pages/__tests__/`
- Property tests use fast-check (already installed) with minimum 100 iterations per property

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "6.1", "7.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "6.2", "6.3", "7.2", "7.3"] },
    { "id": 2, "tasks": ["1.4", "3.1", "4.1", "6.4", "7.4", "8.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "4.3", "8.2", "8.3"] },
    { "id": 4, "tasks": ["3.3", "4.4"] },
    { "id": 5, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 6, "tasks": ["10.4"] }
  ]
}
```
