# BackgroundSearch privacy

Applies to BackgroundSearch v2.7.1. Updated September 9, 2026.

BackgroundSearch is a browser extension. It doesn't operate a search server, load remote executable code or send usage reports to its developer. That doesn't make browsing or searching anonymous.

## What is stored

- **Browser sync storage:** feature settings, enabled and custom engines, site rules, groups, theme and result-tab preferences. If you enable browser sync, your browser's provider can sync those settings to your other devices. Custom engine URLs and site-rule patterns are part of those settings.
- **Local extension storage:** engine-use timestamps and up to 50 recent side-panel searches, including the query, engine name and time. These aren't copied into the settings export or sync storage. Old usage timestamps are pruned whenever a new search is recorded, and the popup shows only the past seven days.
- The toolbar counter and short-lived tab state are kept in memory and can reset when the extension's background process restarts.
- An exported configuration is a JSON file wherever you choose to save it. Treat private engine URLs and hostname rules in that file as private information.

## What leaves your browser

A search opens the selected provider directly. That provider receives the query, ordinary browser connection information and any cookies its site normally receives. POST engines submit their configured form fields. Reverse-image search sends the image URL to the provider. BackgroundSearch doesn't upload the image itself.

Engine lists and Quick Menu request icons from `https://www.google.com/s2/favicons`. Each request includes the engine's hostname, including a custom engine's hostname. Google receives normal connection information with that request. When icons can't load, Settings shows colored initials and Quick Menu keeps the engine names. Avoid private hostnames in custom engines if this icon request is unsuitable for your use.

Importing an OpenSearch descriptor fetches the URL you enter. The target server receives that request. The extension doesn't bypass a site's cross-origin restrictions.

A custom template may include `%url`, `%title` or `%host`. Those placeholders send information about the current page to the engine you configured when the search path supports them. Check the template before using it on a private page.

## Clipboard and page access

Clipboard text is requested only after you choose **Search clipboard text**. That text becomes a query sent to the selected engine. It isn't polled or read in the background. Your browser or the active page can block access.

Content scripts observe text selection, Shift state and optional middle-click links on pages where you allow them. Tab access lets the extension read the current tab's URL and title and manage tab placement. It doesn't have the browser-history API permission and doesn't export your browsing history.

## Permissions

**tabs** and **activeTab** support tab management and page-aware search. **contextMenus** adds right-click actions. **storage** saves your settings and the local data described above. **clipboardRead** and **scripting** support the explicit clipboard action. Chrome also uses **tabGroups** and **sidePanel**. Firefox omits those Chrome-only permissions.

## Clear or remove data

Click **Clear** in the side panel to remove its recent-search list. Reset buttons restore their named settings sections. To remove all local extension data, uninstall the extension. Delete exported JSON files separately and manage browser sync through your browser's settings. Your browser's ordinary browsing history is separate from the extension's local list.

[Source and support](https://github.com/SysAdminDoc/BackgroundSearch) · [Installation guide](../README.md#install-in-a-few-minutes)
