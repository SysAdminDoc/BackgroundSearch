# BackgroundSearch

![Version](https://img.shields.io/badge/version-v2.6.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-lightgrey)

Chrome extension that forces new tabs to open in the background and adds custom search engines to the right-click context menu.

## Features

- **Force Background Tabs** — New tabs open behind your current tab instead of switching to them
- **Shift Modifier Override** — Hold Shift while clicking to invert the current background/foreground default
- **Context Menu Search** — Highlight text, right-click, and search with any enabled engine. Results open in a background tab
- **Quick Menu** — Floating engine buttons appear near your text selection for one-click search (optional)
- **29 Search Engine Presets** — Google, Bing, DuckDuckGo, YouTube, Reddit, GitHub, Kagi, MDN, Hacker News, arXiv, npm, and more
- **Search All Engines** — One right-click item fans out across every enabled engine simultaneously, auto-grouped in a tab group
- **Engine Groups** — Organize engines into named groups (Dev, Shopping, Research) that appear as sub-menus in the right-click menu
- **Reverse Image Search** — Right-click any image to reverse search via Google Lens, Yandex, TinEye, or Bing
- **Clipboard Search** — Right-click any page to search your clipboard text
- **Tab Placement Control** — Open search results next to your current tab or at the end of the tab bar
- **Per-Site Rules** — Force foreground or background per-domain with exact, glob, or regex matching
- **Custom Engine Editor** — Add engines with `%s`, `%url`, `%title`, `%host` URL templates; GET or POST method
- **OpenSearch Import** — Import engines directly from `opensearch.xml` descriptor URLs
- **Omnibox Search** — Type `bs query` in the address bar; supports bang syntax (`bs !yt cats`)
- **Side Panel** — Persistent search interface with search history (open via Chrome side panel)
- **Engine Usage Stats** — Top 5 engines of the week shown in the popup
- **Favicon Auto-Fetch** — Engine favicons loaded automatically with colored-initial fallback
- **Badge Counter** — Background tab count shown on the toolbar icon
- **Export / Import Config** — Backup and restore your full settings as a JSON file
- **Dark / Light / System Theme** — Catppuccin Mocha and Latte with system preference detection
- **Zero Bloat** — No tracking, no analytics, no remote code, fully open source

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Usage

- Click the toolbar icon to open settings
- Toggle **Force Background Tabs** and **Context Menu Search** independently
- Enable **Quick Menu** to get floating engine buttons when you select text
- Enable **Search All Engines** to fan out across all enabled engines at once (auto-grouped)
- Use the **Tab Placement** control to choose where new tabs appear
- Enable/disable individual search engines — only enabled engines appear in the right-click menu
- Use **+ Add custom engine** or **+ Import OpenSearch** to add any search engine
- Type `bs query` in the address bar, or `bs !yt cats` for bang-syntax engine selection
- Right-click images for reverse image search, or any page to search clipboard text
- Open the **Side Panel** for a persistent search interface with history
