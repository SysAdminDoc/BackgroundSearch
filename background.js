// BackgroundSearch v2.1.0
// Forces new tabs to open in the background + custom context menu search.

const ENGINES = [
  { id: "google",       name: "Google",         url: "https://www.google.com/search?q=%s" },
  { id: "bing",         name: "Bing",           url: "https://www.bing.com/search?q=%s" },
  { id: "duckduckgo",   name: "DuckDuckGo",     url: "https://duckduckgo.com/?q=%s" },
  { id: "yahoo",        name: "Yahoo",          url: "https://search.yahoo.com/search?p=%s" },
  { id: "brave",        name: "Brave Search",   url: "https://search.brave.com/search?q=%s" },
  { id: "ecosia",       name: "Ecosia",         url: "https://www.ecosia.org/search?q=%s" },
  { id: "startpage",    name: "Startpage",      url: "https://www.startpage.com/sp/search?query=%s" },
  { id: "yandex",       name: "Yandex",         url: "https://yandex.com/search/?text=%s" },
  { id: "baidu",        name: "Baidu",          url: "https://www.baidu.com/s?wd=%s" },
  { id: "perplexity",   name: "Perplexity",     url: "https://www.perplexity.ai/search?q=%s" },
  { id: "wolframalpha", name: "Wolfram Alpha",  url: "https://www.wolframalpha.com/input/?i=%s" },
  { id: "wikipedia",    name: "Wikipedia",      url: "https://en.wikipedia.org/wiki/Special:Search?search=%s" },
  { id: "youtube",      name: "YouTube",        url: "https://www.youtube.com/results?search_query=%s" },
  { id: "reddit",       name: "Reddit",         url: "https://www.reddit.com/search/?q=%s" },
  { id: "github",       name: "GitHub",         url: "https://github.com/search?q=%s" },
  { id: "stackoverflow",name: "Stack Overflow", url: "https://stackoverflow.com/search?q=%s" },
  { id: "amazon",       name: "Amazon",         url: "https://www.amazon.com/s?k=%s" },
  { id: "ebay",         name: "eBay",           url: "https://www.ebay.com/sch/i.html?_nkw=%s" },
  { id: "twitch",       name: "Twitch",         url: "https://www.twitch.tv/search?term=%s" },
  { id: "imdb",         name: "IMDb",           url: "https://www.imdb.com/find/?q=%s" },
];

const DEFAULTS = {
  bgTabsEnabled: true,
  searchEnabled: true,
  enabledEngines: ["google"],
};

let settings = { ...DEFAULTS };
let lastActiveTabId = null;
let recentlyCreatedTabs = new Set();

// ── Background Tab Logic ──

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (recentlyCreatedTabs.has(activeInfo.tabId)) {
    recentlyCreatedTabs.delete(activeInfo.tabId);
    if (settings.bgTabsEnabled && lastActiveTabId !== null) {
      chrome.tabs.update(lastActiveTabId, { active: true }).catch(() => {});
    }
  } else {
    lastActiveTabId = activeInfo.tabId;
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (settings.bgTabsEnabled && tab.active) {
    recentlyCreatedTabs.add(tab.id);
    setTimeout(() => recentlyCreatedTabs.delete(tab.id), 500);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  recentlyCreatedTabs.delete(tabId);
  if (tabId === lastActiveTabId) lastActiveTabId = null;
});

// ── Context Menu Search ──

async function buildContextMenus() {
  await chrome.contextMenus.removeAll();

  if (!settings.searchEnabled) return;

  const enabled = ENGINES.filter((e) => settings.enabledEngines.includes(e.id));
  if (enabled.length === 0) return;

  if (enabled.length === 1) {
    // Single engine — no submenu needed
    chrome.contextMenus.create({
      id: `search_${enabled[0].id}`,
      title: `Search ${enabled[0].name} for "%s"`,
      contexts: ["selection"],
    });
  } else {
    // Parent menu
    chrome.contextMenus.create({
      id: "bs_parent",
      title: `BackgroundSearch "%s"`,
      contexts: ["selection"],
    });

    for (const engine of enabled) {
      chrome.contextMenus.create({
        id: `search_${engine.id}`,
        parentId: "bs_parent",
        title: engine.name,
        contexts: ["selection"],
      });
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const engineId = info.menuItemId.replace("search_", "");
  const engine = ENGINES.find((e) => e.id === engineId);
  if (!engine || !info.selectionText) return;

  const searchUrl = engine.url.replace("%s", encodeURIComponent(info.selectionText));

  // Open in background tab (next to current tab)
  chrome.tabs.create({
    url: searchUrl,
    active: false,
    index: tab ? tab.index + 1 : undefined,
    openerTabId: tab ? tab.id : undefined,
  });
});

// ── Settings Sync ──

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "settingsChanged") {
    loadSettings();
  }
});

async function loadSettings() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  settings = data;
  await buildContextMenus();
  await updateIcon();
}

// ── Icon Drawing ──

async function updateIcon() {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext("2d");

  const active = settings.bgTabsEnabled || settings.searchEnabled;
  const color = active ? "#89b4fa" : "#585b70";

  // Magnifying glass circle (transparent background)
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(52, 52, 36, 0, Math.PI * 2);
  ctx.stroke();

  // Handle
  ctx.beginPath();
  ctx.moveTo(78, 78);
  ctx.lineTo(114, 114);
  ctx.stroke();

  const sizes = [16, 32, 48, 128];
  const imageData = {};
  for (const size of sizes) {
    const s = new OffscreenCanvas(size, size);
    const sc = s.getContext("2d");
    sc.drawImage(canvas, 0, 0, size, size);
    imageData[size] = sc.getImageData(0, 0, size, size);
  }

  await chrome.action.setIcon({ imageData });
  await chrome.action.setTitle({
    title: `BackgroundSearch${active ? "" : " (disabled)"}`,
  });
}

// ── Init ──

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) lastActiveTabId = tab.id;
  } catch {}
  await loadSettings();
}

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
