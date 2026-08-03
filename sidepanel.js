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
  });
  settings = data;

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
  const engine = all.find((e) => e.id === engineId) || all[0];
  if (!engine) return;

  const url = engine.url.replace("%s", encodeURIComponent(query.trim()));
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const isFg = (settings.fgEngines || []).includes(engine.id);
  const opts = { url, active: isFg };
  if (!isFg && settings.tabPlacement !== "end" && tab) opts.index = tab.index + 1;
  if (tab) opts.openerTabId = tab.id;
  await api.tabs.create(opts);

  await saveHistory(query.trim(), engine.name);
  renderHistory();
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
    const row = document.createElement("div");
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

load();
