// BackgroundSearch v2.7.1
// Forces new tabs to open in the background + custom context menu search.

const api = globalThis.browser || globalThis.chrome;

let ENGINES = [];

let statsQueue = Promise.resolve();

function trackEngineUse(engineId) {
  const next = statsQueue.then(() => recordEngineUse(engineId));
  statsQueue = next.catch(error => console.error('Could not save engine usage', error));
  return next;
}

async function recordEngineUse(engineId) {
  const { engineStats = {} } = await api.storage.local.get({ engineStats: {} });
  const now = Date.now();
  if (!engineStats[engineId]) engineStats[engineId] = [];
  engineStats[engineId].push(now);
  const weekAgo = now - 7 * 86400000;
  for (const id of Object.keys(engineStats)) {
    engineStats[id] = engineStats[id].filter((t) => t > weekAgo);
    if (engineStats[id].length === 0) delete engineStats[id];
  }
  await api.storage.local.set({ engineStats });
}

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
  quickMenu: false,
};

let settings = { ...DEFAULTS };
const lastActiveTabs = new Map();
let recentlyCreatedTabs = new Set();
let shiftHeld = false;
let bgTabCount = 0;

// â”€â”€ Badge â”€â”€

function updateBadge() {
  const text = bgTabCount > 0 ? String(bgTabCount) : "";
  callOptional(api.action, "setBadgeText", { text });
  callOptional(api.action, "setBadgeBackgroundColor", { color: "#89b4fa" });
  callOptional(api.action, "setBadgeTextColor", { color: "#1e1e2e" });
}

function callOptional(target, method, args) {
  if (!target?.[method]) return;
  try {
    const result = target[method](args);
    if (result?.catch) result.catch(() => {});
  } catch {}
}

async function readClipboardText(tabId) {
  if (!api.scripting?.executeScript) return "";
  const results = await api.scripting.executeScript({
    target: { tabId },
    func: () => navigator.clipboard.readText(),
  });
  return results?.[0]?.result || "";
}

// â”€â”€ Site Rule Matching â”€â”€

let compiledRules = [];

function compileRules() {
  compiledRules = (settings.siteRules || []).map((rule) => {
    let re = null;
    if (rule.type === "exact") {
      re = new RegExp("^" + rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
    } else if (rule.type === "glob") {
      const escaped = rule.pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      re = new RegExp("^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
    } else if (rule.type === "regex") {
      try { re = new RegExp(rule.pattern, "i"); } catch { re = null; }
    }
    return { re, action: rule.action };
  }).filter((r) => r.re);
}

function matchSiteRule(url) {
  if (!url) return null;
  let hostname;
  try { hostname = new URL(url).hostname; } catch { return null; }
  for (const { re, action } of compiledRules) {
    if (re.test(hostname)) return action;
  }
  return null;
}

// â”€â”€ Background Tab Logic â”€â”€

function shouldForceBackground(url) {
  const ruleAction = matchSiteRule(url);
  if (ruleAction === "fg") return false;  // always foreground for this site
  if (ruleAction === "bg") return true;   // always background for this site
  // "default" or no match: use global toggle + shift modifier
  return settings.bgTabsEnabled !== shiftHeld;
}

api.tabs.onActivated.addListener((activeInfo) => {
  if (recentlyCreatedTabs.has(activeInfo.tabId)) {
    recentlyCreatedTabs.delete(activeInfo.tabId);
    const previous = lastActiveTabs.get(activeInfo.windowId);
    const switchBack = () => {
      if (previous !== undefined) {
        setTimeout(async () => {
          try {
            const [active] = await api.tabs.query({ active: true, windowId: activeInfo.windowId });
            if (active?.id === activeInfo.tabId) await api.tabs.update(previous, { active: true });
          } catch (error) { console.error('Could not restore the previous tab', error); }
        }, 50);
      }
    };
    api.tabs.get(activeInfo.tabId).then((tab) => {
      if (shouldForceBackground(tab?.pendingUrl || tab?.url)) switchBack();
    }).catch(() => {
      if (shouldForceBackground(null)) switchBack();
    });
  } else {
    lastActiveTabs.set(activeInfo.windowId, activeInfo.tabId);
  }
});

api.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl || tab.url;
  if (shouldForceBackground(url) && tab.active) {
    recentlyCreatedTabs.add(tab.id);
    setTimeout(() => recentlyCreatedTabs.delete(tab.id), 500);
  }
});

api.tabs.onRemoved.addListener((tabId) => {
  recentlyCreatedTabs.delete(tabId);
  for (const [windowId, activeId] of lastActiveTabs) {
    if (tabId === activeId) lastActiveTabs.delete(windowId);
  }
});

// â”€â”€ Context Menu Search â”€â”€

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

  await api.contextMenus.removeAll();

  if (enabled.length === 0 && !settings.searchEnabled) return;

  if (settings.searchEnabled) {
    const REVERSE_ENGINES = [
      { id: "img_google", name: "Google", url: "https://lens.google.com/uploadbyurl?url=%s" },
      { id: "img_yandex", name: "Yandex", url: "https://yandex.com/images/search?rpt=imageview&url=%s" },
      { id: "img_tineye", name: "TinEye", url: "https://tineye.com/search?url=%s" },
      { id: "img_bing",   name: "Bing",   url: "https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:%s" },
    ];
    api.contextMenus.create({ id: "bs_img_parent", title: "Reverse image search", contexts: ["image"] });
    for (const eng of REVERSE_ENGINES) {
      api.contextMenus.create({ id: eng.id, parentId: "bs_img_parent", title: eng.name, contexts: ["image"] });
    }
  }

  api.contextMenus.create({
    id: "bs_clipboard",
    title: "Search clipboard text",
    contexts: ["page"],
  });

  if (enabled.length === 0) return;

  const ctxs = ["selection", "link"];

  if (enabled.length === 1) {
    api.contextMenus.create({
      id: `search_${enabled[0].id}`,
      title: `Search ${enabled[0].name} for "%s"`,
      contexts: ctxs,
    });
    return;
  }

  api.contextMenus.create({
    id: "bs_parent",
    title: `BackgroundSearch "%s"`,
    contexts: ctxs,
  });

  if (settings.searchAll) {
    api.contextMenus.create({
      id: "search_all",
      parentId: "bs_parent",
      title: `Search all ${enabled.length} engines`,
      contexts: ctxs,
    });
    api.contextMenus.create({
      id: "bs_sep",
      parentId: "bs_parent",
      type: "separator",
      contexts: ctxs,
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

  for (const group of groups) {
    if (!usedGroups.has(group.id)) continue;
    api.contextMenus.create({
      id: `group_${group.id}`,
      parentId: "bs_parent",
      title: group.name,
      contexts: ctxs,
    });
    for (const engine of grouped[group.id]) {
      api.contextMenus.create({
        id: `search_${engine.id}`,
        parentId: `group_${group.id}`,
        title: engine.name,
        contexts: ctxs,
      });
    }
  }

  if (usedGroups.size > 0 && ungrouped.length > 0) {
    api.contextMenus.create({
      id: "bs_group_sep",
      parentId: "bs_parent",
      type: "separator",
      contexts: ctxs,
    });
  }

  for (const engine of ungrouped) {
    api.contextMenus.create({
      id: `search_${engine.id}`,
      parentId: "bs_parent",
      title: engine.name,
      contexts: ctxs,
    });
  }
}

function expandTemplate(template, query, tab) {
  let url = template.replace(/%s/g, query);
  const pageUrl = tab?.url || "";
  const pageTitle = tab?.title || "";
  let host = "";
  try { host = new URL(pageUrl).hostname; } catch {}
  url = url.replace(/%url/g, encodeURIComponent(pageUrl));
  url = url.replace(/%title/g, encodeURIComponent(pageTitle));
  url = url.replace(/%host/g, encodeURIComponent(host));
  return url;
}

function isWebUrl(url) {
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}

function engineNavigationUrl(engine, text, tab) {
  const query = encodeURIComponent(text);
  const url = expandTemplate(engine.url, query, tab);
  if (!isWebUrl(url)) throw new Error('Search engines must use an HTTP or HTTPS URL.');
  if (engine.method !== 'POST') return url;
  const body = expandTemplate(engine.postParams || 'q=%s', query, tab);
  return api.runtime.getURL('post.html') + '#action=' + encodeURIComponent(url) + '&' + body;
}

async function searchWithEngine(engine, text, tab) {
  const url = engineNavigationUrl(engine, text, tab);
  if ((settings.windowEngines || []).includes(engine.id)) {
    await api.windows.create({ url, focused: true });
  } else {
    const active = (settings.fgEngines || []).includes(engine.id);
    const opts = { url, active };
    if (tab) { opts.openerTabId = tab.id; opts.windowId = tab.windowId; }
    if (!active && settings.tabPlacement !== 'end' && tab) opts.index = tab.index + 1;
    await createResultTab(opts);
    if (!active) { bgTabCount++; updateBadge(); }
  }
  await trackEngineUse(engine.id);
}

async function createResultTab(options) {
  // Create inactive first so the general new-tab rule cannot override an explicit foreground choice.
  const created = await api.tabs.create({ ...options, active: false });
  if (options.active) await api.tabs.update(created.id, { active: true });
  return created;
}

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "bs_clipboard" && tab?.id) {
    try {
      const clipText = await readClipboardText(tab.id);
      if (!clipText) return;
      const engine = getOmniboxEngine();
      if (!engine) return;
      await searchWithEngine(engine, clipText, tab);
    } catch {}
    return;
  }

  if (info.menuItemId.startsWith("img_") && info.srcUrl) {
    const REVERSE = {
      img_google: "https://lens.google.com/uploadbyurl?url=%s",
      img_yandex: "https://yandex.com/images/search?rpt=imageview&url=%s",
      img_tineye: "https://tineye.com/search?url=%s",
      img_bing: "https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:%s",
    };
    const tmpl = REVERSE[info.menuItemId];
    if (tmpl) {
      const url = tmpl.replace("%s", encodeURIComponent(info.srcUrl));
      const opts = { url, active: false, openerTabId: tab?.id };
      if (settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
      api.tabs.create(opts);
      bgTabCount++; updateBadge();
    }
    return;
  }

  const text = info.selectionText || info.linkUrl || "";
  if (!text) return;

  const query = encodeURIComponent(text);

  if (info.menuItemId === "search_all") {
    const enabled = getAllEngines().filter((e) => settings.enabledEngines.includes(e.id));
    const tabIds = [];
    const BATCH = 5;
    let i = 0;
    const openBatch = async () => {
      const batch = enabled.slice(i, i + BATCH);
      for (const eng of batch) {
        const url = expandTemplate(eng.url, query, tab);
        try { const u = new URL(url); if (!["http:", "https:"].includes(u.protocol)) continue; } catch { continue; }
        let navUrl = url;
        if (eng.method === "POST") {
          const postBody = expandTemplate(eng.postParams || "q=%s", query, tab);
          navUrl = api.runtime.getURL("post.html") + "#action=" + encodeURIComponent(url) + "&" + postBody;
        }
        const isFg = (settings.fgEngines || []).includes(eng.id);
        const opts = { url: navUrl, active: isFg, openerTabId: tab?.id };
        if (!isFg && settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
        const created = await createResultTab(opts);
        tabIds.push(created.id);
        if (!isFg) { bgTabCount++; updateBadge(); }
        trackEngineUse(eng.id);
      }
      i += BATCH;
      if (i < enabled.length) { setTimeout(openBatch, 100); return; }
      if (tabIds.length > 1 && api.tabs.group && api.tabGroups?.update) {
        try {
          const groupId = await api.tabs.group({ tabIds });
          const label = text.length > 20 ? text.slice(0, 20) + "..." : text;
          await api.tabGroups.update(groupId, { title: `BS: ${label}`, color: "blue" });
        } catch {}
      }
    };
    openBatch();
    return;
  }

  const engineId = info.menuItemId.replace("search_", "");
  const engine = getAllEngines().find((e) => e.id === engineId);
  if (!engine) return;

  await searchWithEngine(engine, text, tab);
});

// â”€â”€ Settings Sync â”€â”€

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || (sender.id && sender.id !== api.runtime.id)) return;
  if (msg.type === 'getEngines') {
    if (ENGINES.length) { sendResponse(ENGINES); return; }
    fetch(api.runtime.getURL('engines.json')).then(response => response.json())
      .then(sendResponse).catch(() => sendResponse([]));
    return true;
  }
  if (msg.type === "settingsChanged") {
    loadSettings();
  } else if (msg.type === "modifierState") {
    shiftHeld = !!msg.shift;
  } else if (msg.type === "openTab") {
    if (!isWebUrl(msg.url)) return;
    const bg = shouldForceBackground(msg.url);
    const tab = sender.tab;
    const opts = { url: msg.url, active: !bg };
    if (bg && settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
    if (tab) opts.openerTabId = tab.id;
    createResultTab(opts).catch(error => console.error('Could not open link', error));
    if (bg) { bgTabCount++; updateBadge(); }
  } else if (msg.type === "quickMenuSearch" || msg.type === 'panelSearch') {
    (async () => {
      await loadSettings();
      const engine = getAllEngines().find(e => e.id === msg.engineId && settings.enabledEngines.includes(e.id));
      if (!engine || typeof msg.text !== 'string' || !msg.text.trim()) throw new Error('Choose an enabled search engine.');
      const tab = sender.tab || (await api.tabs.query({ active: true, currentWindow: true }))[0];
      await searchWithEngine(engine, msg.text.trim(), tab);
      return { ok: true, engineName: engine.name };
    })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  } else if (msg.type === "resetBadge") {
    bgTabCount = 0;
    updateBadge();
  }
});

async function migrateSettings() {
  const data = await api.storage.sync.get(null);
  const version = data._schemaVersion || 0;
  if (version >= SCHEMA_VERSION) return;

  const merged = { ...DEFAULTS };
  for (const key of Object.keys(data)) {
    if (key in DEFAULTS) merged[key] = data[key];
  }
  merged._schemaVersion = SCHEMA_VERSION;
  await api.storage.sync.set(merged);
}

async function loadSettings() {
  const data = await api.storage.sync.get(DEFAULTS);
  settings = data;
  compileRules();
  await buildContextMenus();
  await updateIcon();
}

// â”€â”€ Icon Drawing â”€â”€

async function updateIcon() {
  const active = settings.bgTabsEnabled || settings.searchEnabled;
  if (!api.action) return;
  if (typeof OffscreenCanvas === "undefined") {
    callOptional(api.action, "setTitle", {
      title: `BackgroundSearch${active ? "" : " (disabled)"}`,
    });
    return;
  }

  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext("2d");

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

  if (api.action.setIcon) await api.action.setIcon({ imageData });
  if (api.action.setTitle) await api.action.setTitle({
    title: `BackgroundSearch${active ? "" : " (disabled)"}`,
  });
}

// â”€â”€ Omnibox â”€â”€

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

function parseBang(text) {
  const match = text.match(/^!(\S+)\s+(.*)/);
  if (!match) return null;
  const typed = match[1].toLowerCase();
  const bang = ({ yt: 'youtube', gh: 'github', ddg: 'duckduckgo' })[typed] || typed;
  const query = match[2];
  const allEngines = getAllEngines();
  const enabled = allEngines.filter((e) => settings.enabledEngines.includes(e.id));
  const engine = enabled.find((e) =>
    e.id.toLowerCase() === bang ||
    e.name.toLowerCase().startsWith(bang) ||
    e.id.toLowerCase().startsWith(bang)
  );
  return engine ? { engine, query } : null;
}

api.omnibox.onInputChanged.addListener((text, suggest) => {
  const bang = parseBang(text);
  if (bang) {
    api.omnibox.setDefaultSuggestion({
      description: `Search <dim>${escXml(bang.engine.name)}</dim> for <match>${escXml(bang.query)}</match>`,
    });
    return;
  }
  const engine = getOmniboxEngine();
  if (!engine) return;
  api.omnibox.setDefaultSuggestion({
    description: `Search <dim>${escXml(engine.name)}</dim> for <match>${escXml(text)}</match>`,
  });
});

api.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const bang = parseBang(text.trim());
  const engine = bang ? bang.engine : getOmniboxEngine();
  const query = bang ? bang.query : text.trim();
  if (!engine || !query) return;
  const url = engineNavigationUrl(engine, query, (await api.tabs.query({ active: true, currentWindow: true }))[0]);
  trackEngineUse(engine.id);

  if (disposition === "currentTab") {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab) { api.tabs.update(tab.id, { url }); return; }
  }

  const fg = disposition === "newForegroundTab";
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const opts = { url, active: fg };
  if (!fg && settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
  await createResultTab(opts);
  if (!fg) { bgTabCount++; updateBadge(); }
});

// â”€â”€ Init â”€â”€

async function init(doMigrate) {
  const resp = await fetch(api.runtime.getURL("engines.json"));
  ENGINES = await resp.json();
  if (doMigrate) await migrateSettings();
  try {
    const tabs = await api.tabs.query({ active: true });
    for (const tab of tabs) lastActiveTabs.set(tab.windowId, tab.id);
  } catch {}
  await loadSettings();
}

function runInit(doMigrate) {
  init(doMigrate).catch(() => {});
}

api.runtime.onStartup.addListener(() => runInit(false));
api.runtime.onInstalled.addListener((details) => runInit(details.reason === "update" || details.reason === "install"));
runInit(false);
