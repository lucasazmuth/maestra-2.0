# Tasks

## Task 1: Create useCanAddTrack hook

- [x] 1.1 Create `src/hooks/useCanAddTrack.ts` with `deriveCanAddTrack` pure function and `useCanAddTrack` hook that accepts `currentCount` parameter and returns `CanAddTrackResult`
- [x] 1.2 Export `CanAddTrackResult` interface with fields: `canAdd`, `currentCount`, `maxTracks`, `shouldShowUpsell`
- [x] 1.3 Implement comparison logic: `currentCount < maxCatalogTracks` → canAdd true, else canAdd false
- [x] 1.4 Write property-based test: canAdd derivation correctness (Property 1) #pbt
- [x] 1.5 Write property-based test: shouldShowUpsell is always inverse of canAdd (Property 2) #pbt
- [x] 1.6 Write property-based test: Pro user (maxTracks=Infinity) never blocked (Property 3) #pbt
- [x] 1.7 Write property-based test: maxTracks passthrough integrity (Property 4) #pbt
- [x] 1.8 Write property-based test: currentCount passthrough integrity (Property 5) #pbt

## Task 2: Add TrackCounter to Catalog Page

- [x] 2.1 Create inline `TrackCounter` FC in `src/pages/Catalog/index.tsx` that accepts `currentCount` and `maxTracks` props and renders "{currentCount}/{maxTracks} faixas"
- [x] 2.2 Apply red color (#e53e3e) to TrackCounter when `currentCount >= maxTracks`
- [x] 2.3 Conditionally render TrackCounter only when `maxTracks !== Infinity` (free users only)
- [x] 2.4 Position TrackCounter in the header area next to the Nova Faixa button when manual tab is active

## Task 3: Integrate useCanAddTrack and modify Nova Faixa button

- [x] 3.1 Import and call `useCanAddTrack(items.length)` in the Catalog component
- [x] 3.2 Modify Nova Faixa button click handler: if `!canAdd`, open UpsellModal instead of TrackModal
- [x] 3.3 Apply disabled visual style to Nova Faixa button when `canAdd` is false (opacity: 0.5, cursor: not-allowed)
- [x] 3.4 Maintain button clickability even when visually disabled (to trigger UpsellModal)

## Task 4: Add UpsellModal to Catalog Page

- [x] 4.1 Add `upsellOpen` state and import `UpsellModal` component in Catalog page
- [x] 4.2 Render `<UpsellModal open={upsellOpen} context="catalog-limit" onClose={() => setUpsellOpen(false)} />` in the JSX
- [x] 4.3 Wire `setUpsellOpen(true)` to the Nova Faixa button click when at limit

## Task 5: Unit tests for Catalog page integration

- [x] 5.1 Write unit test: free user with 5 tracks sees counter "5/10 faixas" and enabled button
- [x] 5.2 Write unit test: free user with 10 tracks sees counter "10/10 faixas" in red, button disabled style, clicking opens UpsellModal
- [x] 5.3 Write unit test: pro user sees no counter and enabled button regardless of track count
- [x] 5.4 Write unit test: after creating a track (onSaved), counter updates to reflect new count
