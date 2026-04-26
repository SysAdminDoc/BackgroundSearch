<!-- codex-branding:start -->
<p align="center"><img src="icon.png" width="128" alt="Background Search"></p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-2.2.0-58A6FF?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-4ade80?style=for-the-badge">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Chrome%20Extension-58A6FF?style=for-the-badge">
</p>
<!-- codex-branding:end -->

# BackgroundSearch

![Version](https://img.shields.io/badge/version-v2.2.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-lightgrey)

Chrome extension that forces new tabs to open in the background and adds custom search engines to the right-click context menu.

## Features

- **Force Background Tabs** — New tabs open behind your current tab instead of switching to them
- **Context Menu Search** — Highlight text, right-click, and search with any enabled engine. Results open in a background tab
- **29 Search Engine Presets** — Google, Bing, DuckDuckGo, YouTube, Reddit, GitHub, Kagi, MDN, Hacker News, arXiv, npm, and more
- **Search All Engines** — One right-click item fans out across every enabled engine simultaneously
- **Tab Placement Control** — Open search results next to your current tab or at the end of the tab bar
- **Custom Engine Editor** — Add your own engines with any `%s` URL template; remove them any time
- **Export / Import Config** — Backup and restore your full settings as a JSON file
- **Dark Settings Panel** — Catppuccin Mocha themed popup with per-engine toggles, filter, and enable/disable all
- **Zero Bloat** — No permissions beyond what's needed, no tracking, no analytics

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Usage

- Click the toolbar icon to open settings
- Toggle **Force Background Tabs** and **Context Menu Search** independently
- Enable **Search All Engines** to add a single context menu item that opens all enabled engines at once
- Use the **Tab Placement** control to choose where new tabs appear
- Enable/disable individual search engines — only enabled engines appear in the right-click menu
- Use **+ Add custom engine** to add any site with a `%s` search URL template
- Highlight any text on a page, right-click, and pick a search engine (or "Search all N engines")
