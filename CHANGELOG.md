# Changelog

All notable changes to BackgroundSearch will be documented in this file.

## [v2.3.0] - 2026-04-26

- Added: Omnibox keyword triggers — type `bs <query>` in the address bar to search with a selectable engine
- Added: Per-engine foreground/background toggle — FG/BG badge next to each engine to control tab activation
- Added: Reset to defaults per section — dedicated Reset buttons in Features and Search Engines sections
- Fixed: Omnibox respects tab placement setting for background tab opening
- Fixed: Per-engine FG setting properly reflected in context menu search and search all operations

## [v2.2.0] - 2026-04-26

- Added: 9 new built-in engines — Kagi, Hacker News, MDN Web Docs, Google Images, Google Maps, Twitter/X, npm, arXiv, PubMed (29 total)
- Added: Search All Engines — new popup toggle + context menu "Search all N engines" item to fan-out across every enabled engine simultaneously
- Added: Result tab placement — segmented control in popup to open results "Next to current tab" or "End of bar"
- Added: Custom engine editor — add/delete custom engines with name + `%s` URL template; auto-enabled on add
- Added: Export / Import JSON config — full settings backup and restore via file download / file picker
- Fixed: context menu fan-out search correctly uses tabPlacement setting
- Fixed: Enable All now includes custom engines alongside built-ins

## [v2.1.0] - (HEAD -> main)

- Added: Add Chrome extension build workflow
- Added: New magnifying glass icon with transparent background — v2.1.0
- Added: Add settings popup and context menu search — v2.0.0
- Initial release — Force Background Tab v1.0.0
