# Implementation Plan: Freemium Foundation

## Overview

Transformação do modelo de bloqueio universal para freemium granular. A implementação segue uma cadeia de dependências bottom-up: hook de entitlements → refatoração de hooks existentes → componentes de gate/upsell → reestruturação de rotas → apresentação (empty states, padlocks) → integração final.

**Stack de testes**: Jest + React Testing Library (existente) + fast-check (a instalar para property-based testing).

## Tasks

- [x] 1. Create `useEntitlements` hook with `deriveEntitlements` pure function
  - [x] 1.1 Create `src/hooks/useEntitlements.ts`
    - Export types: `Plan`, `FeatureKey`, `Entitlements`
    - Implement `deriveEntitlements(status, gracePeriodEndsAt, now)` pure function
    - Implement `useEntitlements()` hook that reads from Redux and calls `deriveEntitlements`
    - Use `useMemo` with deps `[status, gracePeriodEndsAt]`
    - Import `PAYWALL_DISABLED` from `../constants/maestra`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 1.2 Install fast-check and write property tests for `deriveEntitlements`
    - Install `fast-check` as devDependency
    - Create `src/hooks/__tests__/useEntitlements.property.test.ts`
    - **Property 1: Plan Derivation Correctness** — For any status/gracePeriod combo, plan is `pro` iff status=active OR (status=overdue AND now < gracePeriodEndsAt)
    - **Property 2: PAYWALL_DISABLED Override** — For any state, when PAYWALL_DISABLED=true, always returns full pro
    - **Property 3: Entitlement Field Consistency** — For any state, all fields are consistent with derived plan (pro→all unlocked, free→all limited)
    - Minimum 100 iterations per property
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9**

- [x] 2. Refactor `useCanCreateArtist` to consume `useEntitlements`
  - [x] 2.1 Refactor `src/hooks/useCanCreateArtist.ts`
    - Replace subscription status switch logic with `useEntitlements()` consumption
    - Use numeric comparison: `artists.length < maxArtists`
    - Rename `shouldRedirectToSubscription` to `shouldShowUpsell`
    - Remove direct Redux `subscription.status` reads
    - Remove `gracePeriodEndsAt` logic (now in useEntitlements)
    - Update `CanCreateArtistResult` interface
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Write unit tests for `useCanCreateArtist`
    - Test: 0 artists + free plan → canCreate=true
    - Test: 1 artist + free plan → canCreate=false, shouldShowUpsell=true
    - Test: N artists + pro plan → canCreate=true
    - Test: 0 artists + pro plan → canCreate=true
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Refactor `useSubscriptionGuard` to delegate to `useEntitlements`
  - [x] 3.1 Refactor `src/hooks/useSubscriptionGuard.ts`
    - Import and use `useEntitlements` for access computation
    - Remove the auto-redirect `useEffect` (RequireFeature handles gating now)
    - Keep polling logic (`fetchSubscriptionStatus` dispatch + interval)
    - Keep caching logic (lastKnownGoodStatus)
    - Derive `hasAccess` from `plan === 'pro'` instead of `computeAccess` function
    - Remove `computeAccess` helper (logic now in `deriveEntitlements`)
    - _Requirements: 9.2, 9.3_

- [x] 4. Checkpoint — Verify hooks layer
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `useEntitlements` exports correctly
  - Verify `useCanCreateArtist` and `useSubscriptionGuard` compile without errors

- [x] 5. Create `RequireFeature` gate component
  - [x] 5.1 Create `src/components/RequireFeature.tsx`
    - Accept `feature: FeatureKey` prop
    - Use `useEntitlements()` to check `entitlements[feature]`
    - Render `<Outlet />` when feature is allowed
    - Render `<LockedFeature feature={feature} />` when blocked
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for RequireFeature gate logic
    - **Property 4: RequireFeature Gate Correctness** — For any feature key and entitlements object, renders Outlet iff entitlements[feature]===true, otherwise LockedFeature
    - Test the gate decision logic (can be tested via deriveEntitlements + feature lookup without full render)
    - **Validates: Requirements 3.1, 3.2**

- [x] 6. Create `LockedFeature` component
  - [x] 6.1 Create `src/components/LockedFeature/config.ts`
    - Define `LockedFeatureConfig` interface (icon, title, benefits[3], gradient)
    - Export `LOCKED_FEATURE_CONFIG: Record<FeatureKey, LockedFeatureConfig>`
    - Configs for: `planning`, `team`, `nyta` with Portuguese copy
    - Use `FiTarget`, `FiUsers`, `FiTrendingUp` icons from react-icons
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 6.2 Create `src/components/LockedFeature/index.tsx`
    - Accept `feature: FeatureKey` prop
    - Read config from `LOCKED_FEATURE_CONFIG[feature]`
    - Render gradient hero background, icon (48px, #1ed760), title (h1, white)
    - Render 3 benefit bullets with checkmarks
    - Render CTA button "Assinar Maestra Pro" that navigates to `/assinatura`
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 6.3 Create `src/components/LockedFeature/LockedFeature.module.scss`
    - Full-page layout centered vertically and horizontally
    - Responsive: stack on mobile, max-width on desktop
    - Use design tokens: SpotifyMixUITitle for heading, #1ed760 accent, 24px pill button
    - _Requirements: 4.4_

  - [ ]* 6.4 Write unit tests for LockedFeature
    - Test renders correct title/benefits for each feature context
    - Test CTA button navigates to `/assinatura`
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 7. Create `UpsellModal` component
  - [x] 7.1 Create `src/components/UpsellModal/config.ts`
    - Define `UpsellConfig` interface (title, description, benefits[], icon)
    - Export `UPSELL_CONFIG: Record<UpsellContext, UpsellConfig>`
    - Configs for: `artist-limit`, `catalog-limit` with Portuguese copy
    - _Requirements: 5.3, 5.6_

  - [x] 7.2 Create `src/components/UpsellModal/index.tsx`
    - Accept props: `open`, `context: UpsellContext`, `onClose`
    - Use `antd Modal` component with dark theme styling
    - Render icon + title from config
    - Render description + benefits list + price (R$ 49,90/mês)
    - Primary CTA "Assinar Maestra Pro" → navigates to `/assinatura` + calls `onClose()`
    - Ghost button "Agora não" → calls `onClose()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 7.3 Create `src/components/UpsellModal/UpsellModal.module.scss`
    - Dark modal styling consistent with app theme
    - Benefit list with checkmark icons
    - Price highlight styling
    - _Requirements: 5.3_

  - [ ]* 7.4 Write unit tests for UpsellModal
    - Test renders with artist-limit context
    - Test renders with catalog-limit context
    - Test CTA navigates to `/assinatura`
    - Test dismiss button calls `onClose`
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 8. Checkpoint — Verify components layer
  - Ensure all tests pass, ask the user if questions arise.
  - Verify RequireFeature, LockedFeature, UpsellModal render without errors

- [x] 9. Restructure routes in `App.tsx`
  - [x] 9.1 Modify `src/App.tsx` route tree
    - Remove `<SubscriptionGuardWrapper />` wrapper entirely
    - Remove import of `SubscriptionGuardWrapper`
    - Remove `<RequireOnboarding />` wrapper from dashboard, catalog, agenda routes
    - Move `/artists`, `/artists/:id`, `/artists/:id/catalog`, `/artists/:id/agenda`, `/artists/:id/profile` to be direct children (free access)
    - Wrap `/artists/:id/wizard/*` and `/artists/:id/action-plan` in `<RequireFeature feature="planning" />`
    - Wrap `/artists/:id/team` in `<RequireFeature feature="team" />`
    - Import `RequireFeature` from `../components/RequireFeature`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 9.1, 10.1, 10.2, 10.3_

  - [ ]* 9.2 Write integration tests for route access
    - Test: free user can access `/artists` without redirect
    - Test: free user can access `/artists/:id` (dashboard) without redirect
    - Test: free user accessing `/artists/:id/wizard` sees LockedFeature
    - Test: free user accessing `/artists/:id/team` sees LockedFeature
    - Test: pro user can access all routes normally
    - _Requirements: 2.1, 2.2, 2.5, 2.7, 2.8_

- [x] 10. Implement Dashboard empty states for planning
  - [x] 10.1 Create `src/components/DashboardEmptyState/index.tsx`
    - Accept props: `title`, `description`
    - Render card with muted description text and "Assinar Pro" CTA button
    - CTA navigates to `/assinatura`
    - _Requirements: 7.4_

  - [x] 10.2 Create `src/components/DashboardEmptyState/DashboardEmptyState.module.scss`
    - Card styling with `#181818` background, 8px border-radius
    - Muted text colors, accent button styling
    - _Requirements: 7.4_

  - [x] 10.3 Integrate empty states into Dashboard page
    - Import `useEntitlements` in Dashboard page (`src/pages/Dashboard`)
    - Conditionally render `DashboardEmptyState` for planning cards when `planning === false`
    - Keep catalog/agenda cards rendering with actual data regardless of plan
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 10.4 Write unit tests for Dashboard empty states
    - Test: free user sees DashboardEmptyState for planning cards
    - Test: free user sees actual data for catalog/agenda cards
    - Test: pro user sees all cards with actual data
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. Add sidebar padlock indicators
  - [x] 11.1 Modify `src/components/Layout/components/Sidebar/index.tsx`
    - Import `useEntitlements` and `FiLock` from react-icons
    - Add `locked?: boolean` prop to `NavItem` component
    - Render `FiLock` icon (12px, `#b3b3b3`, marginLeft: auto) when `locked && !collapsed`
    - Add `locked` field to modules array: `!planning` for action-plan, `!team` for team
    - Remove the `onboarding` conditional that only shows wizard when onboarding is incomplete (no longer needed since RequireFeature handles the gate)
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 11.2 Write property test for sidebar padlock logic
    - **Property 5: Sidebar Padlock Consistency** — For any derived plan, padlocks display iff feature entitlement is false
    - Test the lock derivation logic (modules.map with entitlements)
    - **Validates: Requirements 8.1, 8.2**

- [x] 12. Integrate UpsellModal into artist creation flow
  - [x] 12.1 Wire UpsellModal into Artists page / CreateArtistModal
    - Import `UpsellModal` and `useCanCreateArtist` in the Artists page (`src/pages/Artists`)
    - When user triggers "create artist" and `shouldShowUpsell === true`, show `UpsellModal` with context `'artist-limit'`
    - Manage modal open/close state with `useState`
    - Block the create action when `canCreate === false`
    - _Requirements: 5.1, 6.2_

  - [ ]* 12.2 Write unit tests for artist creation upsell flow
    - Test: free user with 1 artist clicking create shows UpsellModal
    - Test: free user with 0 artists clicking create proceeds normally
    - Test: pro user clicking create always proceeds normally
    - _Requirements: 5.1, 6.1, 6.2, 6.3_

- [x] 13. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify free user flow: login → artists → dashboard → sees empty states + padlocks → premium route shows LockedFeature
  - Verify pro user flow: login → all routes accessible, no padlocks, no empty states
  - Verify PAYWALL_DISABLED=true bypasses all gates

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["5.1", "6.1", "6.2", "6.3", "7.1", "7.2", "7.3"] },
    { "id": 4, "tasks": ["5.2", "6.4", "7.4"] },
    { "id": 5, "tasks": ["9.1"] },
    { "id": 6, "tasks": ["9.2", "10.1", "10.2", "10.3", "11.1"] },
    { "id": 7, "tasks": ["10.4", "11.2", "12.1"] },
    { "id": 8, "tasks": ["12.2"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–5 from design)
- The project uses Jest (via react-scripts) — install `fast-check` for PBT
- All new components use SCSS modules for styling consistency
- Portuguese (pt-BR) copy throughout — no i18n needed for MVP upsell content
