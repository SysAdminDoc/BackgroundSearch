# BackgroundSearch v2.7.1 verification

The release is checked locally. It doesn't depend on a hosted build service.

## Package and runtime checks

`node --test tests/runtime.test.cjs` exercises the shipped JavaScript, including short search aliases, URL encoding, POST templates, invalid configuration imports, tab targeting, which new tabs get sent to the background, and serialized usage writes. `python -B -m unittest discover -s tests -p test_build.py` checks both manifests, license and setup inclusion, deterministic ZIP bytes and refusal to clean an unexpected output path.

The secondary CRX is parsed after signing. Its RSA-SHA256 proof, embedded public-key identity, ZIP payload and forward-slash entry names must verify. This doesn't turn it into a Chrome Web Store package or a Mozilla-signed add-on.

## Installed Chromium checks

Tested with Chromium 151.0.7922.34 in an owned headless profile, using the actual built Chrome extension. The checks exercise engine toggles, site rules, themes, a real Quick Menu click, foreground targeting, disabling middle-click capture on an already-open page, settings export and malformed import handling. A real click on a link that opens its own tab has to leave the reading page in front, while a New Tab page opened by the browser has to keep focus. The narrow side panel is exercised with search history, clearing and live engine changes.

The local fixture supplies demonstration text. A loopback proxy blocks outgoing provider traffic, and intercepted requests get a local response from the harness. Search destination URLs are checked through the browser's tab API. Live provider results and signed-in accounts weren't tested.

Run `npm ci`, `npx playwright install chromium`, `python -B build_extension.py`, then `npm run test:browser`. All captures remain under ignored `test-results/` until reviewed.

## Installed Firefox checks

Tested with Firefox 157.0.1 and Mozilla geckodriver in a separate headless profile. The actual Firefox package installs temporarily as `backgroundsearch@sysadmindoc.com`. Its popup loads all presets, saves settings, receives engine data from the background, opens an encoded search URL and rejects a disabled provider. The suite also clicks a link that opens a new tab and runs the command behind the + button. The link's tab must stay behind the page, and the New Tab page must stay in front.

Run `npm run test:firefox` after installing Firefox and geckodriver. Set `FIREFOX_BINARY` or `GECKODRIVER_BINARY` if they aren't in the standard locations. This lane also blocks outside traffic and retains its review capture locally.

## Visual selection

README screenshots are captures of the installed extension. Dark and light settings, the Quick Menu and a 320px-wide side panel were reviewed. Earlier attempts are retained in the [concept archive](../assets/concepts/README.md).

The original blue browser-and-search artwork remains unchanged. It is a dark-background raster composition, not a transparent icon. The toolbar icon is still the small magnifying glass. Static PNG sizes were exported from the existing runtime drawing so the installed icon has the same clean handle as the live Chrome toolbar. The original PNGs remain archived.

## Checks that still require external conditions

- Firefox signing and a permanent installer are not provided.
- Live search-provider result pages, paid accounts and site-specific OpenSearch servers weren't exercised by the isolated checks.
- Native browser right-click menus and the real clipboard weren't automated. Their code was reviewed, but there's no native-menu screenshot or clipboard integration test.
- The side-panel screenshot shows actual installed panel content at its working width, not the browser's surrounding sidebar frame.

The [setup and feature guide](guide.md) lists the same limits. Browser policy and provider availability can change independently of the extension.
