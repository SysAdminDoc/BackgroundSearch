# BackgroundSearch v2.7.1 guide

Start with the [installation steps](../README.md#install-in-a-few-minutes). An offline setup guide is also included in both download ZIPs.

## Choose your engines

Open the toolbar popup and filter the list by name. Enabling an engine adds it to the right-click menu and optional Quick Menu. The BG button keeps results in a background tab. Click it to cycle through FG (foreground tab), WIN (new window), then BG again.

Drag an engine row to change its order. Filtering temporarily disables dragging. For named submenus, open **Tab behavior, appearance and site rules**, add a group, then assign engines using the dropdown on each row. Groups affect the right-click menu, not Quick Menu's compact layout.

Quick Menu displays at most 12 enabled engines. Search All uses every enabled engine, opens results in batches of five and groups result tabs when Chrome's tab-group API is available. Search All uses result tabs even for engines set to WIN.

## Page-aware and POST engines

Use **Add custom engine** and give it a name and an HTTP or HTTPS URL containing `%s`. Prefer HTTPS for remote providers. The optional request-method selector supports POST; the default form body is `q=%s`.

| Placeholder | Value sent to the selected engine |
| --- | --- |
| `%s` | The selected text, link URL or typed query |
| `%url` | Current page URL |
| `%title` | Current page title |
| `%host` | Current page hostname |

Values are URL-encoded. For example, `https://example.org/search?q=%s&site=%host` sends the query and current hostname to that engine. Use page-aware templates only with providers you trust.

For a custom POST body, export the settings, add a `postParams` string to the relevant custom engine, then import the JSON. Keep its existing ID. A body such as `query=%s&source=%host` sends two fields. The URL editor still requires `%s` in the URL template, including for POST engines.

OpenSearch import supports HTTP(S) descriptors with a GET `Url` of type `text/html` and a `{searchTerms}` placeholder. Descriptors with separate `Param` elements or POST methods need manual setup. A site must allow the extension's cross-origin request; import doesn't bypass that restriction.

## Tab rules

Rules match the destination hostname. `example.org` matches exactly; `*.example.org` matches subdomains, not the bare domain. A wildcard `*` matches any number of characters and `?` matches one. Regex rules are limited to 256 characters; use simple anchored expressions.

The first matching rule wins. An explicit foreground or background rule takes priority over the global toggle and Shift. The default action falls back to the global toggle and current Shift state.

## Feature limits

- Browser settings pages and extension stores restrict page scripts. Grant the extension access to the normal sites where you need selection and tab handling. Reload pages after an extension update.
- Search-provider results, accounts and paid access depend on the provider. Presets don't provide subscriptions or bypass restrictions.
- Clipboard search requires permission and a page where the browser permits clipboard access. It reads only after you request it. If the browser blocks it, select text on the page instead.
- Reverse-image search sends a publicly reachable image URL. A provider usually can't fetch an image behind your login or a local file URL.
- Firefox uses an unsigned temporary installation. It has no Chrome side panel or automatic tab groups. No permanent signed Firefox package is included.
- Browser sync has quotas. If saving fails, the popup restores saved settings and shows an error. A local-only fallback isn't claimed. Export a backup before reducing a large set of custom engines or rules.
- Site permissions, browser policy or other extensions can affect tab activation. A new-window engine opens a separate browser window.

## Build and verification

Run `python -B build_extension.py` for separate Chrome and Firefox packages. It cleans only the verified `dist` path in this repository. The ZIPs contain a root manifest, runtime files, an offline installation guide and the MIT license.

For the installed Chromium checks, run `npm ci`, `npx playwright install chromium`, then `npm run test:browser`. That lane uses a fresh owned profile with `--headless=new`, blocks outside traffic through a local proxy and preserves screenshots under ignored `test-results/`. It doesn't use your personal browser or clipboard. Provider destinations are verified against browser tab URLs, not live search results.

The optional secondary CRX is built with `node tools/package-crx.mjs`. Keep `BackgroundSearch-selfhost.pem` private and stable. Restore it from your private backup for later releases. `--create-key` is only for the first self-hosted package; replacing a key changes that CRX identity.

See [verification notes](verification.md) for the tested browsers and remaining external checks.
