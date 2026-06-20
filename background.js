// BackgroundSearch v2.5.0
// Forces new tabs to open in the background + custom context menu search.

let ENGINES = [];

const SCHEMA_VERSION = 1;

const DEFAULTS = {
  _schemaVersion: SCHEMA_VERSION,
  bgTabsEnabled: true,
  searchEnabled: true,
  searchAll: false,
  tabPlacement: "next",
  omniboxEngineId: "",
  enabledEngines: ["google"],
  fgEngines: [],
  customEngines: [],
  engineGroups: [],
  engineGroupMap: {},
  windowEngines: [],
  siteRules: [],
  engineOrder: [],
  middleClickCapture: false,
};

let settings = { ...DEFAULTS };
let lastActiveTabId = null;
let recentlyCreatedTabs = new Set();
let shiftHeld = false; // Shift modifier state from content script

// ── Site Rule Matching ──

function matchSiteRule(url) {
  if (!url) return null;
  const rules = settings.siteRules || [];
  let hostname;
  try { hostname = new URL(url).hostname; } catch { return null; }

  for (const rule of rules) {
    let matched = false;
    if (rule.type === "exact") {
      matched = hostname === rule.pattern;
    } else if (rule.type === "glob") {
      // Convert glob to regex: * -> .*, ? -> .
      const escaped = rule.pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
      matched = re.test(hostname);
    } else if (rule.type === "regex") {
      try { matched = new RegExp(rule.pattern, "i").test(hostname); } catch {}
    }
    if (matched) return rule.action; // "fg", "bg", or "default"
  }
  return null;
}

// ── Background Tab Logic ──

function shouldForceBackground(url) {
  const ruleAction = matchSiteRule(url);
  if (ruleAction === "fg") return false;  // always foreground for this site
  if (ruleAction === "bg") return true;   // always background for this site
  // "default" or no match: use global toggle + shift modifier
  return settings.bgTabsEnabled !== shiftHeld;
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (recentlyCreatedTabs.has(activeInfo.tabId)) {
    recentlyCreatedTabs.delete(activeInfo.tabId);
    // Get the tab's URL for site-rule matching
    chrome.tabs.get(activeInfo.tabId).then((tab) => {
      if (shouldForceBackground(tab?.pendingUrl || tab?.url) && lastActiveTabId !== null) {
        chrome.tabs.update(lastActiveTabId, { active: true }).catch(() => {});
      }
    }).catch(() => {
      if (shouldForceBackground(null) && lastActiveTabId !== null) {
        chrome.tabs.update(lastActiveTabId, { active: true }).catch(() => {});
      }
    });
  } else {
    lastActiveTabId = activeInfo.tabId;
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl || tab.url;
  if (shouldForceBackground(url) && tab.active) {
    recentlyCreatedTabs.add(tab.id);
    setTimeout(() => recentlyCreatedTabs.delete(tab.id), 500);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  recentlyCreatedTabs.delete(tabId);
  if (tabId === lastActiveTabId) lastActiveTabId = null;
});

// ── Context Menu Search ──

function getAllEngines() {
  const all = [...ENGINES, ...(settings.customEngines || [])];
  const order = settings.engineOrder || [];
  if (order.length === 0) return all;
  const byId = new Map(all.map((e) => [e.id, e]));
  const ordered = [];
  for (const id of order) {
    if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); }
  }
  for (const e of byId.values()) ordered.push(e);
  return ordered;
}

// Config snapshot for skipping redundant rebuilds
let currentMenuConfig = null;

async function buildContextMenus() {
  const allEngines = getAllEngines();
  const enabled = settings.searchEnabled
    ? allEngines.filter((e) => settings.enabledEngines.includes(e.id))
    : [];
  const groupMap = settings.engineGroupMap || {};
  const groups = settings.engineGroups || [];

  // Build a config snapshot to detect whether anything actually changed
  const newConfig = JSON.stringify({
    searchEnabled: settings.searchEnabled,
    searchAll: settings.searchAll,
    enabledIds: enabled.map((e) => e.id),
    enabledNames: enabled.map((e) => e.name),
    groups,
    groupMap,
  });

  if (newConfig === currentMenuConfig) return;
  currentMenuConfig = newConfig;

  await chrome.contextMenus.removeAll();

  if (enabled.length === 0) return;

  if (enabled.length === 1) {
    chrome.contextMenus.create({
      id: `search_${enabled[0].id}`,
      title: `Search ${enabled[0].name} for "%s"`,
      contexts: ["selection"],
    });
    return;
  }

  // Multiple engines — use parent menu
  chrome.contextMenus.create({
    id: "bs_parent",
    title: `BackgroundSearch "%s"`,
    contexts: ["selection"],
  });

  if (settings.searchAll) {
    chrome.contextMenus.create({
      id: "search_all",
      parentId: "bs_parent",
      title: `Search all ${enabled.length} engines`,
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "bs_sep",
      parentId: "bs_parent",
      type: "separator",
      contexts: ["selection"],
    });
  }

  // Partition engines into groups and ungrouped
  const usedGroups = new Set();
  const grouped = {};   // groupId -> [engine]
  const ungrouped = [];

  for (const engine of enabled) {
    const gid = groupMap[engine.id];
    if (gid && groups.some((g) => g.id === gid)) {
      usedGroups.add(gid);
      if (!grouped[gid]) grouped[gid] = [];
      grouped[gid].push(engine);
    } else {
      ungrouped.push(engine);
    }
  }

  // Create group sub-menus first
  for (const group of groups) {
    if (!usedGroups.has(group.id)) continue;
    chrome.contextMenus.create({
      id: `group_${group.id}`,
      parentId: "bs_parent",
      title: group.name,
      contexts: ["selection"],
    });
    for (const engine of grouped[group.id]) {
      chrome.contextMenus.create({
        id: `search_${engine.id}`,
        parentId: `group_${group.id}`,
        title: engine.name,
        contexts: ["selection"],
      });
    }
  }

  // Separator between groups and ungrouped engines (if both exist)
  if (usedGroups.size > 0 && ungrouped.length > 0) {
    chrome.contextMenus.create({
      id: "bs_group_sep",
      parentId: "bs_parent",
      type: "separator",
      contexts: ["selection"],
    });
  }

  // Ungrouped engines
  for (const engine of ungrouped) {
    chrome.contextMenus.create({
      id: `search_${engine.id}`,
      parentId: "bs_parent",
      title: engine.name,
      contexts: ["selection"],
    });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) return;

  const query = encodeURIComponent(info.selectionText);
  const openTab = (url, engineId) => {
    try { const u = new URL(url); if (!["http:", "https:"].includes(u.protocol)) return; } catch { return; }
    const isWindow = (settings.windowEngines || []).includes(engineId);
    if (isWindow) {
      chrome.windows.create({ url, focused: true });
      return;
    }
    const isFg = (settings.fgEngines || []).includes(engineId);
    const opts = { url, active: isFg, openerTabId: tab?.id };
    if (!isFg && settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
    chrome.tabs.create(opts);
  };

  if (info.menuItemId === "search_all") {
    const enabled = getAllEngines().filter((e) => settings.enabledEngines.includes(e.id));
    for (const engine of enabled) {
      openTab(engine.url.replace("%s", query), engine.id);
    }
    return;
  }

  const engineId = info.menuItemId.replace("search_", "");
  const engine = getAllEngines().find((e) => e.id === engineId);
  if (!engine) return;

  openTab(engine.url.replace("%s", query), engine.id);
});

// ── Settings Sync ──

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "settingsChanged") {
    loadSettings();
  } else if (msg.type === "modifierState") {
    shiftHeld = !!msg.shift;
  } else if (msg.type === "openTab") {
    // Middle-click capture: open tab respecting force-background + site rules
    const bg = shouldForceBackground(msg.url);
    const tab = sender.tab;
    const opts = { url: msg.url, active: !bg };
    if (bg && settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
    if (tab) opts.openerTabId = tab.id;
    chrome.tabs.create(opts);
  }
});

async function migrateSettings() {
  const data = await chrome.storage.sync.get(null);
  const version = data._schemaVersion || 0;
  if (version >= SCHEMA_VERSION) return;

  const merged = { ...DEFAULTS };
  for (const key of Object.keys(data)) {
    if (key in DEFAULTS) merged[key] = data[key];
  }
  merged._schemaVersion = SCHEMA_VERSION;
  await chrome.storage.sync.set(merged);
}

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

// ── Omnibox ──

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getOmniboxEngine() {
  const allEngines = getAllEngines();
  const enabled = allEngines.filter((e) => settings.enabledEngines.includes(e.id));
  return enabled.find((e) => e.id === settings.omniboxEngineId) || enabled[0] || null;
}

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const engine = getOmniboxEngine();
  if (!engine) return;
  chrome.omnibox.setDefaultSuggestion({
    description: `Search <dim>${escXml(engine.name)}</dim> for <match>${escXml(text)}</match>`,
  });
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const engine = getOmniboxEngine();
  if (!engine || !text.trim()) return;
  const url = engine.url.replace("%s", encodeURIComponent(text.trim()));
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const opts = { url, active: false };
  if (settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
  chrome.tabs.create(opts);
});

// ── Init ──

async function init(doMigrate) {
  const resp = await fetch(chrome.runtime.getURL("engines.json"));
  ENGINES = await resp.json();
  if (doMigrate) await migrateSettings();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) lastActiveTabId = tab.id;
  } catch {}
  await loadSettings();
}

chrome.runtime.onStartup.addListener(() => init(false));
chrome.runtime.onInstalled.addListener((details) => init(details.reason === "update" || details.reason === "install"));
