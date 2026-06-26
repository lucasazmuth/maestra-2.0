# Requirements Document

## Introduction

Replace the current scattered icon system in the Maestra 2.0 application with a centralized, custom SVG icon library. The app currently uses a mix of `react-icons/fi` (Feather Icons) in Sidebar, Topbar, and MobileNav components, along with inline SVG components in `src/components/Icons/index.tsx`. The new system consolidates all icons into a single, type-safe icon component library with consistent sizing, color states, and optimized inline SVG rendering.

## Glossary

- **Icon_System**: The centralized module (`src/components/Icons/`) that exports all SVG icon components used across the Maestra 2.0 application
- **Icon_Component**: A React functional component that renders an inline SVG element with configurable size and color props
- **Active_State**: The visual state of an icon when its associated navigation item or control is currently selected, rendered in white (#ffffff)
- **Inactive_State**: The visual state of an icon when its associated navigation item or control is not selected, rendered in muted gray (#b3b3b3)
- **Sidebar**: The left navigation panel (`src/components/Layout/components/Sidebar/index.tsx`) displaying artist modules and admin links
- **Topbar**: The top horizontal bar (`src/components/Layout/components/Topbar/index.tsx`) containing notifications, settings, and user profile
- **MobileNav**: The bottom tab bar (`src/components/Layout/components/MobileNav/index.tsx`) for mobile navigation
- **Icon_Props**: The TypeScript interface defining the accepted properties for every Icon_Component (size, color, className, aria attributes)

## Requirements

### Requirement 1: Centralized Icon Component Architecture

**User Story:** As a developer, I want all icons defined in a single module with a consistent component API, so that I can import and use icons without depending on external icon libraries.

#### Acceptance Criteria

1. THE Icon_System SHALL export each icon as a named React functional component from `src/components/Icons/index.tsx`
2. THE Icon_System SHALL define a shared `IconProps` TypeScript interface containing optional properties `size` (number), `color` (string), `className` (string), and all standard SVG element HTML attributes, where any additional props passed to an Icon_Component are forwarded to the root `<svg>` element
3. WHEN an Icon_Component receives a `size` prop with a numeric value between 1 and 512, THE Icon_Component SHALL render the SVG with both width and height equal to the `size` value in pixels
4. WHEN an Icon_Component receives a `color` prop, THE Icon_Component SHALL apply the color value to the SVG `fill` attribute
5. WHEN no `size` prop is provided, THE Icon_Component SHALL default to 24 pixels for both width and height
6. WHEN no `color` prop is provided, THE Icon_Component SHALL default to `currentColor` for the SVG `fill` attribute
7. THE Icon_System SHALL render all icons as inline SVG elements without external file loading or network requests
8. WHEN an Icon_Component receives a `className` prop, THE Icon_Component SHALL apply it to the root `<svg>` element in addition to any internally required attributes

### Requirement 2: Complete Icon Inventory Replacement

**User Story:** As a developer, I want every icon in the application mapped to a new custom SVG component, so that no external icon library dependency remains for UI icons.

#### Acceptance Criteria

1. THE Icon_System SHALL provide the following navigation icons as exported SVG components from `src/components/Icons/index.tsx`: `HomeIcon`, `SearchIcon`, `LibraryIcon`, `AlbumIcon`, `BrowseIcon`
2. THE Icon_System SHALL provide the following action icons as exported SVG components from `src/components/Icons/index.tsx`: `FilterIcon`, `SortIcon`, `AddAlbumIcon`, `MoreOptionsIcon`, `PinIcon`, `CreatePlaylistIcon`, `UploadIcon`, `DownloadIcon`
3. THE Icon_System SHALL provide the following utility icons as exported SVG components from `src/components/Icons/index.tsx`: `SettingsIcon`, `NotificationsIcon`, `UsersIcon`, `GuideIcon`, `SparkleIcon`, `ArtistProfileIcon`, `QueueIcon`
4. WHEN the Sidebar component renders navigation items, THE Sidebar SHALL import and use Icon_Components from `src/components/Icons/index.tsx` and SHALL contain zero import statements referencing `react-icons/fi`
5. WHEN the Topbar component renders action buttons, THE Topbar SHALL import and use Icon_Components from `src/components/Icons/index.tsx` and SHALL contain zero import statements referencing `react-icons/fi`
6. WHEN the MobileNav component renders tab icons, THE MobileNav SHALL import and use Icon_Components from `src/components/Icons/index.tsx` and SHALL contain zero import statements referencing `react-icons/fi`
7. THE Icon_System SHALL maintain all existing player control icons (`ShuffleIcon`, `SkipBack`, `SkipNext`, `Replay`, `ReplayOne`, `Pause`, `Play`, `VolumeIcon`, `VolumeMuteIcon`, `VolumeOneIcon`, `VolumeTwoIcon`) in the centralized module at `src/components/Icons/index.tsx`
8. WHEN a developer searches the project source files (excluding `node_modules`) for `react-icons/fi` imports, THE codebase SHALL return zero matches in Sidebar, Topbar, and MobileNav component files
9. THE Icon_System SHALL render each icon component as an inline SVG element with `role="img"` and `aria-hidden="true"` attributes, at a default size of 24×24 pixels for navigation and utility icons and 16×16 pixels for player control icons

### Requirement 3: Active and Inactive State Support

**User Story:** As a user, I want navigation icons to visually indicate whether their associated section is active, so that I can easily identify my current location in the app.

#### Acceptance Criteria

1. WHEN an Icon_Component receives `color` prop value `#ffffff`, THE Icon_Component SHALL render its SVG `fill` and `stroke` attributes using `#ffffff` (white)
2. WHEN an Icon_Component receives `color` prop value `#b3b3b3`, THE Icon_Component SHALL render its SVG `fill` and `stroke` attributes using `#b3b3b3` (muted gray)
3. IF no `color` prop is provided to an Icon_Component, THEN THE Icon_Component SHALL render with the default fill color `currentColor`
4. THE Icon_System SHALL accept a `color` prop of type string on every icon component, eliminating the need for separate Active/Inactive component variants (e.g., no separate `ActiveHomeIcon`)
5. WHEN the Sidebar `NavItem` component has `active=true`, THE NavItem SHALL pass `#ffffff` as the color prop to its Icon_Component
6. WHEN the Sidebar `NavItem` component has `active=false`, THE NavItem SHALL pass `#b3b3b3` as the color prop to its Icon_Component
7. WHEN the MobileNav item is in active state (has CSS class `mobile-nav-item--active`), THE MobileNav item SHALL pass `#ffffff` as the color prop to its Icon_Component

### Requirement 4: Consistent Sizing Across Contexts

**User Story:** As a designer, I want icons to maintain consistent sizes in each UI context, so that the visual hierarchy is preserved across the application.

#### Acceptance Criteria

1. WHEN an Icon_Component is rendered in the Sidebar, THE Sidebar SHALL pass `size={20}` to the Icon_Component, resulting in a rendered icon of 20×20 pixels
2. WHEN an Icon_Component is rendered in the MobileNav, THE MobileNav SHALL pass `size={24}` to the Icon_Component, resulting in a rendered icon of 24×24 pixels
3. WHEN an Icon_Component is rendered in the Topbar action buttons, THE Topbar SHALL pass `size={18}` to the Icon_Component, resulting in a rendered icon of 18×18 pixels
4. WHEN an Icon_Component is rendered as a player control, THE player component SHALL apply `ControlStyle` (height: 1.15em) for transport controls (play, pause, skip) and `SongExtraControlStyle` (height: 1.2em, maxWidth: 17px) for secondary controls (shuffle, repeat, volume, queue)
5. THE Icon_Component SHALL accept a numeric `size` prop that sets both the width and height of the rendered SVG element in pixels
6. IF no `size` prop and no explicit style override is provided to the Icon_Component, THEN THE Icon_Component SHALL render at the default size of 24 pixels

### Requirement 5: Removal of External Icon Library Dependency

**User Story:** As a developer, I want to remove the `react-icons` package dependency from the project, so that the bundle size is reduced and the icon system is fully self-contained.

#### Acceptance Criteria

1. WHEN the migration is complete, THE application SHALL contain zero import statements referencing any `react-icons` sub-package, including `react-icons/fi`, `react-icons/fa6`, `react-icons/lu`, and `react-icons/fc`
2. WHEN all `react-icons` imports have been removed, THE `react-icons` package SHALL be removed from both `dependencies` and `devDependencies` in `package.json`
3. IF a component still references a `react-icons` import after the package is removed, THEN THE build process SHALL produce a compilation error indicating the missing module
4. THE Icon_System SHALL not introduce any new external icon library dependency beyond those already listed in `package.json`
5. WHEN a `react-icons` icon is replaced with a custom SVG component, THE replacement component SHALL accept the same `size` and `color` props as the original `react-icons` component
6. WHEN the migration is complete, THE application SHALL pass its existing build step with zero errors and zero warnings related to missing icon imports

### Requirement 6: Accessibility Compliance

**User Story:** As a user relying on assistive technology, I want icons to have appropriate ARIA attributes, so that screen readers can correctly interpret or skip decorative icons.

#### Acceptance Criteria

1. WHEN an Icon_Component is rendered alongside a visible text label within the same parent interactive element or container, THE Icon_Component SHALL render with `aria-hidden="true"` and `role="img"` so that screen readers skip the redundant graphic
2. WHEN an Icon_Component is used as the sole interactive element without a visible text label, THE Icon_Component SHALL accept an `aria-label` prop with a minimum length of 2 characters and render it as the `aria-label` attribute on the SVG element
3. IF an Icon_Component is used as the sole interactive element without a visible text label and no `aria-label` prop is provided, THEN THE Icon_Component SHALL log a development-mode warning indicating that an accessible label is required
4. THE Icon_System SHALL set `focusable="false"` on all SVG elements to prevent unintended tab focus in Internet Explorer and Edge legacy

### Requirement 7: SVG Optimization

**User Story:** As a developer, I want all SVG paths to be optimized and minimal, so that the bundle size impact of inline SVGs is kept as small as possible.

#### Acceptance Criteria

1. THE Icon_System SHALL use a single `<svg>` element per icon with no nested `<svg>` elements
2. THE Icon_System SHALL include a `viewBox` attribute with the value `0 0 24 24` on every `<svg>` element to enable scaling without distortion at any rendered size
3. THE Icon_System SHALL exclude the following attributes and content from all icon SVG definitions: `xmlns`, `xml:space`, `data-name`, editor metadata attributes, XML comments, and any attribute prefixed with `sodipodi:` or `inkscape:`
4. IF an icon's visual output can be achieved with a single `<path>` element without loss of visual fidelity, THEN THE Icon_Component SHALL use a single `<path>` element rather than multiple shape elements (e.g., multiple `<path>`, `<rect>`, `<circle>`, `<polygon>`)
5. THE Icon_System SHALL produce inline SVG markup of no more than 1024 characters per icon (including the opening and closing `<svg>` tags)
