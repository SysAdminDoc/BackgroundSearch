// BackgroundSearch â€” Side Panel

const api = globalThis.browser || globalThis.chrome;

let ENGINES = [];
let settings = {};
const MAX_HISTORY = 50;

async function load() {
  const resp = await fetch(api.runtime.getURL("engines.json"));
  ENGINES = await resp.json();

  const data = await api.storage.sync.get({
    enabledEngines: ["google"],
    customEngines: [],
    engineOrder: [],
    tabPlacement: "next",
    fgEngines: [],
    themeMode: 'system',
  });
  settings = data;
  document.documentElement.dataset.theme = data.themeMode;

  const select = document.getElementById("engineSelect");
  const all = getAllEngines();
  const enabled = all.filter((e) => settings.enabledEngines.includes(e.id));
  select.replaceChildren();
  for (const engine of enabled) {
    const opt = document.createElement("option");
    opt.value = engine.id;
    opt.textContent = engine.name;
    select.appendChild(opt);
  }
  document.getElementById('searchBtn').disabled = enabled.length === 0;
  document.getElementById('searchStatus').textContent = enabled.length ? '' : 'Enable an engine in the toolbar settings to search.';

  renderHistory();
}

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

async function doSearch(query, engineId) {
  if (!query.trim()) return;
  const all = getAllEngines();
  const engine = all.find((e) => e.id === engineId && settings.enabledEngines.includes(e.id));
  if (!engine) return;

  const status = document.getElementById('searchStatus');
  try {
    const result = await api.runtime.sendMessage({ type: 'panelSearch', text: query.trim(), engineId });
    if (!result?.ok) throw new Error(result?.error || 'Could not open search.');
    await saveHistory(query.trim(), engine.name);
    await renderHistory();
    status.textContent = `Opened ${engine.name}.`;
  } catch (error) {
    status.textContent = error.message;
    console.error('Search failed', error);
  }
}

async function saveHistory(query, engineName) {
  const { searchHistory = [] } = await api.storage.local.get({ searchHistory: [] });
  searchHistory.unshift({ query, engine: engineName, time: new Date().toISOString() });
  if (searchHistory.length > MAX_HISTORY) searchHistory.length = MAX_HISTORY;
  await api.storage.local.set({ searchHistory });
}

async function renderHistory() {
  const { searchHistory = [] } = await api.storage.local.get({ searchHistory: [] });
  const list = document.getElementById("historyList");
  list.replaceChildren();

  if (searchHistory.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No recent searches";
    list.appendChild(empty);
    return;
  }

  for (const item of searchHistory) {
    const row = document.createElement("button");
    row.className = "history-item";
    const ago = timeAgo(item.time);
    const query = document.createElement("span");
    query.className = "history-query";
    query.textContent = item.query;
    const engine = document.createElement("span");
    engine.className = "history-engine";
    engine.textContent = item.engine;
    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = ago;
    row.append(query, engine, time);
    row.addEventListener("click", () => {
      document.getElementById("query").value = item.query;
    });
    list.appendChild(row);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  return Math.floor(diff / 86400) + "d";
}

document.getElementById("searchBtn").addEventListener("click", () => {
  const query = document.getElementById("query").value;
  const engineId = document.getElementById("engineSelect").value;
  doSearch(query, engineId);
});

document.getElementById("query").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const query = document.getElementById("query").value;
    const engineId = document.getElementById("engineSelect").value;
    doSearch(query, engineId);
  }
});

document.getElementById("clearHistory").addEventListener("click", async () => {
  await api.storage.local.set({ searchHistory: [] });
  renderHistory();
});

api.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') load().catch(error => { document.getElementById('searchStatus').textContent = error.message; });
});
load().catch(error => { document.getElementById('searchStatus').textContent = error.message; });
