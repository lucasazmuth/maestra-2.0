# Implementation Plan: Icon System Replacement

## Overview

Replace the scattered `react-icons` usage across ~30 files with a centralized, type-safe SVG icon system in `src/components/Icons/index.tsx`. The migration proceeds in three phases: refactor the Icons module with a shared `IconProps` interface, create all missing Feather-equivalent icons, then migrate every consumer component and remove the `react-icons` dependency.

## Tasks

- [ ] 1. Refactor Icons module — Add IconProps interface and refactor existing icons
  - [ ] 1.1 Define the `IconProps` interface and refactor existing navigation icons
    - Add the shared `IconProps` interface extending `SVGProps<SVGSVGElement>` with `size`, `color`, and `className` optional properties
    - Refactor `HomeIcon`, `SearchIcon`, `LibraryIcon`, `LibraryCollapsedIcon`, `BrowseIcon` to accept `IconProps` with defaults (`size=24`, `color='currentColor'`)
    - Add `role="img"`, `aria-hidden="true"`, `focusable="false"` to all refactored SVGs
    - Remove `ActiveHomeIcon` variant (active state now handled via `color` prop)
    - Implement size clamping (min 1, max 512) and empty-color fallback to `currentColor`
    - Add dev-mode `console.warn` when icon used without `aria-label` and `aria-hidden` is not `true`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.4, 6.1, 6.3, 6.4_

  - [ ] 1.2 Refactor existing player control icons to accept `IconProps`
    - Update `ShuffleIcon`, `SkipBack`, `SkipNext`, `Replay`, `ReplayOne`, `Pause`, `Play` to accept `IconProps` while preserving existing `active` prop behavior
    - Update `VolumeIcon`, `VolumeMuteIcon`, `VolumeOneIcon`, `VolumeTwoIcon`, `DeviceIcon`, `ListIcon`, `DetailsIcon`, `MicrophoneIcon`, `ExpandIcon`, `ExpandOutIcon` similarly
    - Maintain backward compatibility with existing `ControlStyle` and `SongExtraControlStyle` patterns
    - Ensure `viewBox="0 0 16 16"` is preserved on player control icons (they use 16×16 viewBox)
    - _Requirements: 1.2, 2.7, 4.4, 7.2_

  - [ ]* 1.3 Write property tests for IconProps contract (Properties 1–5)
    - **Property 1: Size prop determines rendered dimensions** — Generate random integers 1–512, render icon, assert `width` and `height` match
    - **Property 2: Color prop determines fill attribute** — Generate random hex color strings, render icon, assert `fill` matches
    - **Property 3: className prop is forwarded to SVG element** — Generate random non-empty strings, assert className present on SVG
    - **Property 4: All icons render with correct default accessibility attributes** — Pick random icon, assert `role="img"`, `aria-hidden="true"`, `focusable="false"`
    - **Property 5: aria-label prop renders when provided** — Generate strings length ≥ 2, assert `aria-label` attribute present
    - **Validates: Requirements 1.3, 1.4, 1.8, 2.9, 4.5, 6.1, 6.2, 6.4**

- [ ] 2. Create missing Feather-equivalent icons
  - [ ] 2.1 Create navigation and growth icons
    - Implement `GridIcon` (FiGrid equivalent) — 4-square grid, viewBox 0 0 24 24
    - Implement `ActivityIcon` (FiActivity equivalent) — heartbeat/pulse line
    - Implement `TargetIcon` (FiTarget equivalent) — concentric circles with center dot
    - Implement `CheckSquareIcon` (FiCheckSquare equivalent) — checked square checkbox
    - All icons must follow the `IconProps` pattern, use single `<svg>`, include `viewBox="0 0 24 24"`, and stay ≤ 1024 chars
    - _Requirements: 2.1, 2.4, 2.6, 7.1, 7.2, 7.5_

  - [ ] 2.2 Create operations and action icons
    - Implement `MusicIcon` (FiMusic equivalent) — music note
    - Implement `CalendarIcon` (FiCalendar equivalent) — calendar page
    - Implement `UsersIcon` (FiUsers equivalent) — two person silhouettes
    - Implement `ChevronLeftIcon`, `ChevronRightIcon` (FiChevronLeft/Right equivalents)
    - Implement `PlusIcon` (FiPlus equivalent) — plus sign
    - Implement `LockIcon` (FiLock equivalent) — padlock
    - Implement `DatabaseIcon` (FiDatabase equivalent) — stacked cylinders
    - Implement `MessageCircleIcon` (FiMessageCircle equivalent) — speech bubble
    - _Requirements: 2.1, 2.2, 2.4, 7.1, 7.2, 7.5_

  - [ ] 2.3 Create Topbar and utility icons
    - Implement `BellIcon` (FiBell equivalent) — notification bell
    - Implement `SettingsIcon` (FiSettings equivalent) — gear/cog
    - Implement `LogOutIcon` (FiLogOut equivalent) — exit arrow
    - Implement `ArrowRightIcon`, `ArrowLeftIcon` (FiArrowRight/Left equivalents)
    - Implement `ArrowUpIcon` (FiArrowUp equivalent)
    - Implement `TrashIcon` (FiTrash2 equivalent) — trash can
    - Implement `RefreshIcon` (FiRefreshCw equivalent) — circular arrows
    - Implement `EditIcon` (FiEdit2/FiEdit3 equivalents) — pencil
    - _Requirements: 2.2, 2.3, 2.5, 7.1, 7.2, 7.5_

  - [ ] 2.4 Create remaining utility and brand icons
    - Implement `AlertCircleIcon` (FiAlertCircle equivalent) — circled exclamation
    - Implement `AlertTriangleIcon` (FiAlertTriangle equivalent) — warning triangle
    - Implement `DownloadIcon` (FiDownload equivalent)
    - Implement `UploadCloudIcon` (FiUploadCloud equivalent)
    - Implement `CheckIcon` (FiCheck equivalent) — checkmark
    - Implement `XIcon` (FiX equivalent) — X/close
    - Implement `ChevronDownIcon` (FiChevronDown equivalent)
    - Implement `SpotifyIcon` (FaSpotify equivalent) — Spotify logo path
    - Implement `CreditCardIcon` (FiCreditCard equivalent)
    - Implement `SmartphoneIcon` (FiSmartphone equivalent)
    - Implement `MapPinIcon` (FiMapPin equivalent)
    - Implement `ExternalLinkIcon` (FiExternalLink equivalent)
    - Implement `CameraIcon` (FiCamera equivalent)
    - Implement `ClockIcon` (FiClock equivalent) — distinct from existing player `Clock`
    - Implement `FileTextIcon` (FiFileText equivalent)
    - Implement `EyeIcon`, `EyeOffIcon` (FiEye/FiEyeOff equivalents)
    - Implement `MailIcon` (FiMail equivalent)
    - Implement `UserIcon` (FiUser equivalent — single person)
    - Implement `LoaderIcon` (FiLoader equivalent) — spinning circle
    - Implement `HelpCircleIcon` (FiHelpCircle equivalent)
    - Implement `Share2Icon` (FiShare2 equivalent)
    - Implement `ShieldIcon` (FiShield equivalent)
    - Implement `TrendingUpIcon` (FiTrendingUp equivalent)
    - Implement `AwardIcon` (FiAward equivalent)
    - Implement `LifeBuoyIcon` (FiLifeBuoy equivalent)
    - Implement `RocketIcon` (LuRocket equivalent)
    - Implement `CheckCircleIcon` (FiCheckCircle equivalent)
    - Implement `XCircleIcon` (FiXCircle equivalent)
    - Implement `VisaIcon`, `MastercardIcon`, `AmexIcon`, `DiscoverIcon` (FaCcVisa/Mastercard/Amex/Discover equivalents)
    - _Requirements: 2.2, 2.3, 5.1, 5.4, 7.1, 7.2, 7.5_

  - [ ]* 2.5 Write property test for SVG optimization invariants (Property 6)
    - **Property 6: SVG optimization invariants** — Pick random icon from full registry, render with random valid props, assert: single `<svg>` element, `viewBox` present, no `xmlns`/`xml:space`/`data-name`/editor metadata, total markup ≤ 1024 chars
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

- [ ] 3. Checkpoint — Verify Icons module is complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Migrate primary navigation consumers (Sidebar, MobileNav, Topbar)
  - [ ] 4.1 Migrate Sidebar to use custom icons
    - Replace `import { FiGrid, FiCalendar, FiMusic, FiUsers, FiCheckSquare, FiChevronLeft, FiPlus, FiLock, FiDatabase, FiActivity, FiTarget, FiMessageCircle } from 'react-icons/fi'` with imports from `../../Icons`
    - Update `NavItem` to pass `color={active ? '#ffffff' : '#b3b3b3'}` and `size={20}` to each icon component
    - Update the `groups` array to use new icon components with props: `<GridIcon size={20} />`, `<ActivityIcon size={20} />`, etc.
    - Replace `FiLock` usage for locked indicator with `<LockIcon size={12} color="#b3b3b3" />`
    - Verify zero `react-icons/fi` imports remain in file
    - _Requirements: 2.4, 2.8, 3.5, 3.6, 4.1, 5.1_

  - [ ] 4.2 Migrate MobileNav to use custom icons
    - Replace `import { FiGrid, FiActivity, FiTarget, FiCheckSquare, FiMusic } from 'react-icons/fi'` with imports from `../../Icons`
    - Update items array to use `<GridIcon size={24} color={active ? '#ffffff' : '#b3b3b3'} />` pattern
    - Pass `color` based on `isActive(suffix)` result for each item
    - Verify zero `react-icons/fi` imports remain in file
    - _Requirements: 2.6, 2.8, 3.7, 4.2, 5.1_

  - [ ] 4.3 Migrate Topbar to use custom icons
    - Replace `import { FiBell, FiSettings, FiLogOut } from 'react-icons/fi'` with imports from `../../Icons`
    - Update notification button to use `<BellIcon size={18} color="#b3b3b3" />`
    - Update dropdown menu items to use `<SettingsIcon size={16} />` and `<LogOutIcon size={16} />`
    - Verify zero `react-icons/fi` imports remain in file
    - _Requirements: 2.5, 2.8, 4.3, 5.1_

  - [ ]* 4.4 Write unit tests for consumer icon integration
    - Test Sidebar renders icons at size 20 with correct active/inactive colors
    - Test MobileNav renders icons at size 24 with active state coloring
    - Test Topbar renders icons at size 18
    - _Requirements: 3.5, 3.6, 3.7, 4.1, 4.2, 4.3_

- [ ] 5. Migrate Dashboard and overview pages
  - [ ] 5.1 Migrate Dashboard index and DashboardOverview
    - Replace `import { FiMusic, FiCalendar, FiUsers } from 'react-icons/fi'` in `Dashboard/index.tsx` with custom icons
    - Replace `import { FiCheckSquare, FiCalendar, FiMusic, FiUsers, FiChevronRight } from 'react-icons/fi'` and `import { FaSpotify } from 'react-icons/fa6'` in `Dashboard/overview.tsx`
    - Use `<SpotifyIcon size={16} color="#af2896" />` for the Spotify panel icon
    - Use `<ChevronRightIcon size={14} />` for panel action buttons
    - _Requirements: 2.4, 5.1_

  - [ ] 5.2 Migrate Dashboard sections
    - Replace `import { FaSpotify } from 'react-icons/fa6'` in `Dashboard/sections.tsx` with custom `SpotifyIcon`
    - _Requirements: 5.1_

- [ ] 6. Migrate remaining pages (batch 1: auth, settings, navigation)
  - [ ] 6.1 Migrate Login/AuthShell
    - Replace `import { FcGoogle } from 'react-icons/fc'` and `import { FiMail, FiLock, FiEye, FiEyeOff, FiUser } from 'react-icons/fi'` with custom icons
    - Note: `FcGoogle` (multi-color Google logo) needs a `GoogleIcon` with the branded multi-color SVG or an inline SVG with the official Google colors
    - _Requirements: 5.1, 5.4_

  - [ ] 6.2 Migrate Settings and Payments pages
    - Replace icons in `Settings/index.tsx`: `FiFileText, FiShield, FiLifeBuoy, FiExternalLink, FiChevronRight, FiEdit2, FiCamera, FiClock`
    - Replace icons in `Settings/PaymentHistory.tsx`: `FiRefreshCw, FiUser`
    - Replace icons in `Settings/SubscriptionManagement.tsx`: `FiCheck, FiArrowRight`
    - Replace icons in `Payments/index.tsx`: `FiArrowLeft`
    - _Requirements: 5.1_

  - [ ] 6.3 Migrate Welcome, Legal, Profile, ProfileUnlock, Subscription pages
    - Replace `FiArrowRight` in `Welcome/index.tsx`, `Profile/index.tsx`
    - Replace `FiArrowLeft` in `Legal/index.tsx`, `ProfileUnlock/index.tsx`
    - Replace `FiArrowLeft, FiArrowRight, FiTarget, FiMessageCircle, FiGrid, FiAward` in `Subscription/index.tsx`
    - _Requirements: 5.1_

- [ ] 7. Migrate remaining pages (batch 2: features)
  - [ ] 7.1 Migrate Artists list and ArtistCreate pages
    - Replace `FiPlus, FiTrash2` in `Artists/index.tsx`
    - Replace `FiAlertCircle` in `ArtistCreate/index.tsx`
    - Replace `FiChevronDown, FiArrowRight, FiDownload, FiShare2, FiHelpCircle, FiRefreshCw, FiLock` in `ArtistCreate/DiagnosticReport.tsx`
    - _Requirements: 5.1_

  - [ ] 7.2 Migrate ActionPlan, Agenda, Team, Catalog pages
    - Replace `FiPlus, FiLock` in `ActionPlan/TaskComposer.tsx`
    - Replace `FiTrash2, FiPlus` in `ActionPlan/TaskControls.tsx`
    - Replace `FiCheck, FiEdit2, FiX, FiPlus, FiTrash2` in `ActionPlan/AdvancedPlan.tsx`
    - Replace `FiPlus, FiChevronLeft, FiChevronRight` in `Agenda/index.tsx`
    - Replace `FiPlus, FiTrash2` in `Team/index.tsx`
    - Replace `FiPlus, FiRefreshCw, FiEdit2, FiTrash2, FiLock` and `FaSpotify` in `Catalog/index.tsx`
    - _Requirements: 5.1_

  - [ ] 7.3 Migrate NytaChat and Wizard pages
    - Replace `FiAlertCircle` in `NytaChat/index.tsx`
    - Replace `FiAlertTriangle` in `NytaChat/components/MessageList.tsx`
    - Replace `FiCheck, FiX, FiLoader` in `NytaChat/components/ToolConfirmationCard.tsx`
    - Replace `FiChevronLeft, FiTrash2` in `NytaChat/components/ChatHeader.tsx`
    - Replace `FiArrowUp, FiClock` in `NytaChat/components/InputBar.tsx`
    - Replace `FiShield, FiTrendingUp, FiAlertTriangle` and `LuRocket` in `Wizard/strategyMeta.tsx`
    - Replace `FiX` in `Wizard/ArtifactsPanel.tsx`
    - Replace `FiChevronDown` in `Wizard/index.tsx`
    - Replace `FiArrowUp` in `Wizard/chat/NytaChat.tsx`
    - Replace `FiCheck, FiEdit3, FiPlus, FiRefreshCw, FiTrash2, FiX` in `Wizard/chat/widgets.tsx`
    - _Requirements: 5.1_

  - [ ] 7.4 Migrate checkout and Admin pages
    - Replace `FaCcVisa, FaCcMastercard, FaCcAmex` in `checkout/PaymentMethods.tsx`
    - Replace `FiCreditCard, FiUser, FiCalendar, FiLock, FiSmartphone, FiMapPin` and `FaCcVisa, FaCcMastercard, FaCcAmex, FaCcDiscover` in `checkout/CardForm.tsx`
    - Replace `FiUploadCloud, FiDatabase, FiClock, FiCheckCircle, FiXCircle, FiFileText` in `Admin/KnowledgeBase.tsx`
    - _Requirements: 5.1_

- [ ] 8. Checkpoint — Verify all migrations complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Remove react-icons dependency and final verification
  - [ ] 9.1 Remove react-icons from package.json and verify build
    - Run grep to confirm zero `react-icons` imports remain in `src/` directory
    - Remove `react-icons` from `dependencies` in `package.json`
    - Run `npm install` to update lockfile
    - Run `npm run build` (or project build command) and verify zero errors
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [ ]* 9.2 Write integration test verifying no react-icons imports remain
    - Create a test that programmatically scans `src/**/*.tsx` files for any `react-icons` import pattern
    - Assert zero matches found
    - _Requirements: 5.1, 5.2_

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` (already in devDependencies)
- Unit tests validate specific examples and edge cases
- Player control icons retain em-based sizing via `ControlStyle`/`SongExtraControlStyle` for backward compatibility
- The `FcGoogle` icon (multi-color) requires a custom SVG with Google's branded colors since it cannot use a single `fill` color
- Brand card icons (Visa, Mastercard, Amex, Discover) also need multi-color SVGs with their respective brand colors

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4"] },
    { "id": 4, "tasks": ["2.5", "4.1", "4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "5.1", "5.2"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] }
  ]
}
```
