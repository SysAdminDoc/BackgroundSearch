# BackgroundSearch v2.7.1 verification

The release is checked locally. It doesn't depend on a hosted build service.

## Package and runtime checks

`node --test tests/runtime.test.cjs` exercises the shipped JavaScript, including short search aliases, URL encoding, POST templates, invalid configuration imports, tab targeting and serialized usage writes. `python -B -m unittest discover -s tests -p test_build.py` checks both manifests, license and setup inclusion, deterministic ZIP bytes and refusal to clean an unexpected output path.

The secondary CRX is parsed after signing. Its RSA-SHA256 proof, embedded public-key identity, ZIP payload and forward-slash entry names must verify. This doesn't turn it into a Chrome Web Store package or a Mozilla-signed add-on.

## Installed Chromium checks

Tested with Chromium 151.0.7922.34 in an owned headless profile, using the actual built Chrome extension. The checks exercise engine toggles, site rules, themes, a real Quick Menu click, foreground targeting, disabling middle-click capture on an already-open page, settings export and malformed import handling. The narrow side panel is exercised with search history, clearing and live engine changes.

The local fixture supplies demonstration text. Outgoing provider traffic is blocked by a loopback proxy; where a request is intercepted, the harness supplies a local response. Search destination URLs are verified through the browser's tab API. No live provider search results or authenticated accounts are claimed as tested.

Run `npm ci`, `npx playwright install chromium`, `python -B build_extension.py`, then `npm run test:browser`. All captures remain under ignored `test-results/` until reviewed.

## Installed Firefox checks

Tested with Firefox 155.0.1 and Mozilla geckodriver in a separate headless profile. The actual Firefox package installs temporarily as `backgroundsearch@sysadmindoc.com`. Its popup loads all presets, saves settings, receives engine data from the background, opens an encoded search URL and rejects a disabled provider.

Run `npm run test:firefox` after installing Firefox and geckodriver. Set `FIREFOX_BINARY` or `GECKODRIVER_BINARY` if they aren't in the standard locations. This lane also blocks outside traffic and retains its review capture locally.

## Visual selection

The final README uses installed-extension captures, not reconstructed product screens. Dark and light settings, the Quick Menu and a 320px-wide side panel were reviewed. Earlier attempts are retained in the [concept archive](../assets/concepts/README.md).

The original blue browser-and-search artwork remains unchanged. It is a dark-background raster composition, not a transparent icon. The toolbar keeps its compact magnifying-glass identity. Static PNG sizes were exported from the existing runtime drawing so the installed icon has the same clean handle as the live Chrome toolbar. The original PNGs remain archived.

## Checks that still require external conditions

- Firefox signing and a permanent installer are not provided.
- Live search-provider result pages, paid accounts and site-specific OpenSearch servers weren't exercised by the isolated checks.
- Native browser right-click menus and the real clipboard weren't automated. The related source paths are reviewed, but there is no claim of a native-menu screenshot or clipboard integration test.
- The side-panel screenshot shows actual installed panel content at its working width, not the browser's surrounding sidebar frame.

These limits are also reflected in the [setup and feature guide](guide.md). Browser policy and provider availability can change independently of the extension.
