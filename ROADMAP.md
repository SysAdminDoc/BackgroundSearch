# BackgroundSearch — Roadmap

Chrome MV3 extension that forces new tabs to open in the background and adds right-click context-menu search across 20 configurable engines, with a Catppuccin Mocha popup.

## Planned Features

### Core
- **Per-site rules** — "always foreground" / "always background" / "inherit Chrome default" allowlist/denylist
- **Keyboard modifier override** — hold Shift to invert the current force-background default
- **Rule matching patterns** — glob / regex / tld-suffix, not just exact host
- ✅ **Tab placement control** — "next to active" vs "end of bar" *(v2.2.0)*
- **Middle-click capture** — optionally normalize middle-click behavior across sites that override it

### Context menu
- ✅ **Multi-engine fan-out** — "Search all enabled" opens each engine in its own background tab *(v2.2.0)*
- ✅ **Custom engine editor** — URL template with `%s`, add/delete, auto-enabled *(v2.2.0)*
- **Engine groups / folders** in the right-click menu (e.g., "Dev", "Shopping", "Research")
- **Per-engine new-window / new-tab / current-tab** target
- ✅ **Import/export engines** as JSON (share sets between machines) *(v2.2.0)*
- ✅ **Keyword triggers** — type `bs <query>` in the Omnibox to search with a selected engine *(v2.3.0)*

### Sync / Settings
- `chrome.storage.sync` for engine list + toggles (cross-device) ✅ *(already implemented)*
- ✅ **Export full config bundle** for backup *(v2.2.0)*
- ✅ **Reset-to-defaults per-section** rather than whole-popup *(v2.3.0)*
- ✅ **Per-engine foreground/background toggle** — each engine can be set to open in FG or BG *(v2.3.0)*

### UI / UX
- Drag-to-reorder engines
- Search the engine list live ✅ *(already implemented)*
- Favicon auto-fetch for custom engines (with local fallback sprite)
- Dark / Light / System theme follow
- Shadow DOM for popup-injected UI to avoid site-theme bleed (if ever added)

### Performance
- Replace `chrome.contextMenus.removeAll` + rebuild churn with diff-patch on rule changes
- Lazy-load engine icons in popup via `loading="lazy"`
- Strip unused Chrome permissions in manifest audit pass

## Competitive Research
- **Force Background Tab** ([Chrome Web Store](https://chromewebstore.google.com/detail/force-background-tab/gidlfommnbibbmegmgajdbikelkdcmcl)) — popular, MV3, rule system. Reviews cite reliability regressions after updates and poor external-link handling. Our edge: stable MV3 service-worker design and tested rule engine.
- **background-search (kyo-ago)** — focused on context-menu search only; no force-background. Combining both in one extension is our differentiator.
- **Context Menu Search** — engine-heavy but no background-tab behavior.
- **Native Ctrl+Click / Shift+Middle-Click** — covers half the use case but not context-menu search.

## Nice-to-Haves
- Firefox MV3 port (same codebase, different service-worker registration)
- "Search selection across N engines" with results rendered in a grid popup (no tabs)
- Engine usage stats — show top 5 engines of the last week in the popup header
- Import Chrome's built-in search engines (`chrome://settings/searchEngines`) via clipboard
- OpenSearch descriptor (`opensearch.xml`) import
- Optional DuckDuckGo bang-syntax (`!gh query`) support in the Omnibox keyword

## Open-Source Research (Round 2)

### Related OSS Projects
- **rathinosk/ContextMenuSearch** — https://github.com/rathinosk/ContextMenuSearch — Multi-engine context menu; focused/background tab toggle, next-to-current vs end-of-list tab placement, 60+ predefined engines.
- **ssborbis/ContextSearch-web-ext** — https://github.com/ssborbis/ContextSearch-web-ext — Comprehensive search-engine manager: context menu, Quick menu, Toolbar menu, Sidebar, Page Tiles, Omnibox, hotkeys.
- **ashutoshetw/ContextMenuSearch** — https://github.com/ashutoshetw/ContextMenuSearch — Classic multi-engine extension with focused/background toggle.
- **Pitmairen/selection-search** — https://github.com/Pitmairen/selection-search — Per-engine background-tab setting and popup-menu variants.
- **kyo-ago/background-search** — https://github.com/kyo-ago/background-search — Minimal "keep new tabs in background" targeted tool.
- **fiahfy/context-menu-search** — https://github.com/fiahfy/context-menu-search — Simple Chrome extension for custom context-menu engines.
- **b9chris/YelpSearch** — https://github.com/b9chris/YelpSearch — Starter template for "search a thing" context-menu extensions.

### Features to Borrow
- ✅ **Tab-placement choice** (rathinosk/ContextMenuSearch) — "next to current" vs "end of tab list" setting *(v2.2.0)*
- ✅ **60+ predefined engine catalog** (rathinosk) — expanded to 29 engines; further additions welcome *(v2.2.0)*
- ✅ **"Search all enabled engines" multi-open** (Pitmairen) — context menu item fans out across all enabled engines *(v2.2.0)*
- ✅ **Per-engine background-tab toggle** (Pitmairen/selection-search) — each engine has FG/BG toggle in popup *(v2.3.0)*
- **Quick Menu popup at selection** (ssborbis/ContextSearch-web-ext) — radial/pill menu that floats near the text selection, engines one click away without the right-click detour. Optional toggle.
- **Sidebar / panel view with engine folders** (ssborbis/ContextSearch-web-ext) — power-user view for engines grouped into folders (Dev / Shopping / Research / Privacy) with drag-reorder.
- **Hotkey binding per engine** (ssborbis/ContextSearch-web-ext) — Ctrl+Shift+G for Google, Ctrl+Shift+W for Wikipedia, firing against current selection.
- **Custom URL placeholder beyond `%s`** (fiahfy/context-menu-search) — support `%url`, `%title`, `%host`, `%selection_lower`, `%selection_url_encoded` for advanced engines.

### Patterns & Architectures Worth Studying
- **Declarative `engines.json` with update URL** (rathinosk) — engines defined as data, shipped as a JSON file the extension refreshes, so users contribute via PR rather than code edits.
- **MV3 chrome.contextMenus.create with `documentUrlPatterns` per engine** (multiple) — per-engine enable lets engines be scoped to specific sites (e.g., IMDB search only on movie pages).
- **chrome.tabs.create with `active: false, index: currentIndex+1`** (kyo-ago/background-search) — canonical pattern to open adjacent-background that survives across Chromium versions.
- **Service-worker-only design** (MV3 migration common to all listed) — no persistent background page; menus rebuilt on service-worker wakeup from `chrome.storage.sync` settings for cross-device engine sync.
- **Shadow-DOM Quick Menu** (ssborbis) — the floating selection menu rendered in shadow DOM to avoid host-site CSS leaking in.
