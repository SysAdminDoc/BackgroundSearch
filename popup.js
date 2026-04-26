// BackgroundSearch v2.2.0 — Popup Settings

const ENGINES = [
  { id: "google",       name: "Google",         url: "https://www.google.com/search?q=%s",                  color: "#4285f4" },
  { id: "bing",         name: "Bing",           url: "https://www.bing.com/search?q=%s",                    color: "#00809d" },
  { id: "duckduckgo",   name: "DuckDuckGo",     url: "https://duckduckgo.com/?q=%s",                       color: "#de5833" },
  { id: "yahoo",        name: "Yahoo",          url: "https://search.yahoo.com/search?p=%s",                color: "#720e9e" },
  { id: "brave",        name: "Brave Search",   url: "https://search.brave.com/search?q=%s",                color: "#fb542b" },
  { id: "ecosia",       name: "Ecosia",         url: "https://www.ecosia.org/search?q=%s",                  color: "#36acb8" },
  { id: "startpage",    name: "Startpage",      url: "https://www.startpage.com/sp/search?query=%s",        color: "#6573ff" },
  { id: "yandex",       name: "Yandex",         url: "https://yandex.com/search/?text=%s",                  color: "#ff0000" },
  { id: "baidu",        name: "Baidu",          url: "https://www.baidu.com/s?wd=%s",                       color: "#2932e1" },
  { id: "perplexity",   name: "Perplexity",     url: "https://www.perplexity.ai/search?q=%s",               color: "#20b8cd" },
  { id: "wolframalpha", name: "Wolfram Alpha",  url: "https://www.wolframalpha.com/input/?i=%s",            color: "#dd1100" },
  { id: "wikipedia",    name: "Wikipedia",      url: "https://en.wikipedia.org/wiki/Special:Search?search=%s", color: "#636466" },
  { id: "youtube",      name: "YouTube",        url: "https://www.youtube.com/results?search_query=%s",     color: "#ff0000" },
  { id: "reddit",       name: "Reddit",         url: "https://www.reddit.com/search/?q=%s",                 color: "#ff4500" },
  { id: "github",       name: "GitHub",         url: "https://github.com/search?q=%s",                      color: "#8b5cf6" },
  { id: "stackoverflow",name: "Stack Overflow", url: "https://stackoverflow.com/search?q=%s",               color: "#f48024" },
  { id: "amazon",       name: "Amazon",         url: "https://www.amazon.com/s?k=%s",                       color: "#ff9900" },
  { id: "ebay",         name: "eBay",           url: "https://www.ebay.com/sch/i.html?_nkw=%s",             color: "#e53238" },
  { id: "twitch",       name: "Twitch",         url: "https://www.twitch.tv/search?term=%s",                color: "#9146ff" },
  { id: "imdb",         name: "IMDb",           url: "https://www.imdb.com/find/?q=%s",                             color: "#f5c518" },
  { id: "kagi",         name: "Kagi",           url: "https://kagi.com/search?q=%s",                               color: "#ff7800" },
  { id: "hackernews",   name: "Hacker News",    url: "https://hn.algolia.com/?query=%s",                           color: "#ff6600" },
  { id: "mdn",          name: "MDN Web Docs",   url: "https://developer.mozilla.org/en-US/search?q=%s",            color: "#0092db" },
  { id: "googleimages", name: "Google Images",  url: "https://www.google.com/search?tbm=isch&q=%s",                color: "#34a853" },
  { id: "googlemaps",   name: "Google Maps",    url: "https://www.google.com/maps/search/%s",                      color: "#ea4335" },
  { id: "twitter",      name: "Twitter / X",    url: "https://twitter.com/search?q=%s",                            color: "#1da1f2" },
  { id: "npm",          name: "npm",            url: "https://www.npmjs.com/search?q=%s",                          color: "#cc3534" },
  { id: "arxiv",        name: "arXiv",          url: "https://arxiv.org/search/?query=%s&searchtype=all",          color: "#b31b1b" },
  { id: "pubmed",       name: "PubMed",         url: "https://pubmed.ncbi.nlm.nih.gov/?term=%s",                   color: "#0055a2" },
];

const DEFAULTS = {
  bgTabsEnabled: true,
  searchEnabled: true,
  searchAll: false,
  tabPlacement: "next",
  enabledEngines: ["google"],
  customEngines: [],
};

let settings = {};

async function load() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  settings = data;

  document.getElementById("bgTabsEnabled").checked = settings.bgTabsEnabled;
  document.getElementById("searchEnabled").checked = settings.searchEnabled;
  document.getElementById("searchAll").checked = settings.searchAll || false;

  const tabPlacement = settings.tabPlacement || "next";
  document.querySelectorAll("#tabPlacementCtrl .seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.val === tabPlacement);
  });

  renderEngines();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEngines(filter = "") {
  const list = document.getElementById("engineList");
  list.innerHTML = "";
  const lower = filter.toLowerCase();
  const allEngines = [...ENGINES, ...(settings.customEngines || [])];

  for (const engine of allEngines) {
    if (lower && !engine.name.toLowerCase().includes(lower)) continue;

    const row = document.createElement("div");
    row.className = "toggle-row";

    const initial = escHtml(engine.name.charAt(0));
    const name = escHtml(engine.name);
    const checked = settings.enabledEngines.includes(engine.id) ? "checked" : "";
    const isCustom = engine.id.startsWith("custom_");

    row.innerHTML = `
      <div class="toggle-label">
        <div class="icon" style="background:${engine.color}">${initial}</div>
        <span>${name}</span>
      </div>
      ${isCustom ? `<button class="delete-btn" title="Remove engine" aria-label="Remove ${name}">×</button>` : ""}
      <label class="toggle-switch">
        <input type="checkbox" data-engine="${engine.id}" ${checked}>
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
    `;

    if (isCustom) {
      row.querySelector(".delete-btn").addEventListener("click", () => deleteCustomEngine(engine.id));
    }

    row.querySelector("input").addEventListener("change", (e) => {
      toggleEngine(engine.id, e.target.checked);
    });

    list.appendChild(row);
  }
}

async function toggleEngine(id, on) {
  if (on && !settings.enabledEngines.includes(id)) {
    settings.enabledEngines.push(id);
  } else if (!on) {
    settings.enabledEngines = settings.enabledEngines.filter((e) => e !== id);
  }
  await save();
}

async function save() {
  await chrome.storage.sync.set(settings);
  chrome.runtime.sendMessage({ type: "settingsChanged" });
}

document.getElementById("bgTabsEnabled").addEventListener("change", async (e) => {
  settings.bgTabsEnabled = e.target.checked;
  await save();
});

document.getElementById("searchEnabled").addEventListener("change", async (e) => {
  settings.searchEnabled = e.target.checked;
  document.getElementById("enginesSection").style.opacity = e.target.checked ? "1" : "0.4";
  document.getElementById("enginesSection").style.pointerEvents = e.target.checked ? "auto" : "none";
  await save();
});

document.getElementById("filterInput").addEventListener("input", (e) => {
  renderEngines(e.target.value);
});

document.getElementById("enableAll").addEventListener("click", async () => {
  const allIds = [...ENGINES, ...(settings.customEngines || [])].map((e) => e.id);
  settings.enabledEngines = allIds;
  renderEngines(document.getElementById("filterInput").value);
  await save();
});

document.getElementById("disableAll").addEventListener("click", async () => {
  settings.enabledEngines = [];
  renderEngines(document.getElementById("filterInput").value);
  await save();
});

// ── Search All & Tab Placement ──

document.getElementById("searchAll").addEventListener("change", async (e) => {
  settings.searchAll = e.target.checked;
  await save();
});

document.querySelectorAll("#tabPlacementCtrl .seg-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll("#tabPlacementCtrl .seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    settings.tabPlacement = btn.dataset.val;
    await save();
  });
});

// ── Custom Engines ──

function randomEngineColor() {
  const palette = ["#cba6f7", "#89b4fa", "#94e2d5", "#a6e3a1", "#f9e2af", "#fab387", "#f38ba8", "#74c7ec"];
  return palette[Math.floor(Math.random() * palette.length)];
}

async function addCustomEngine() {
  const nameInput = document.getElementById("newEngineName");
  const urlInput = document.getElementById("newEngineUrl");
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  let valid = true;
  if (!name) { nameInput.style.borderColor = "var(--red)"; valid = false; }
  if (!url || !url.includes("%s")) { urlInput.style.borderColor = "var(--red)"; valid = false; }
  if (!valid) return;

  nameInput.style.borderColor = "";
  urlInput.style.borderColor = "";

  const engine = {
    id: `custom_${Date.now()}`,
    name,
    url,
    color: randomEngineColor(),
  };

  if (!settings.customEngines) settings.customEngines = [];
  settings.customEngines.push(engine);
  if (!settings.enabledEngines.includes(engine.id)) {
    settings.enabledEngines.push(engine.id);
  }

  await save();
  nameInput.value = "";
  urlInput.value = "";
  document.getElementById("addEngineForm").classList.remove("open");
  renderEngines(document.getElementById("filterInput").value);
}

async function deleteCustomEngine(id) {
  settings.customEngines = (settings.customEngines || []).filter((e) => e.id !== id);
  settings.enabledEngines = settings.enabledEngines.filter((e) => e !== id);
  await save();
  renderEngines(document.getElementById("filterInput").value);
}

document.getElementById("toggleAddEngine").addEventListener("click", () => {
  document.getElementById("addEngineForm").classList.toggle("open");
});

document.getElementById("addEngineBtn").addEventListener("click", addCustomEngine);

document.getElementById("newEngineName").addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});

document.getElementById("newEngineUrl").addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});

// ── Export / Import ──

function exportConfig() {
  const data = JSON.stringify(settings, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "background-search-config.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importConfig() {
  document.getElementById("importFile").click();
}

document.getElementById("exportConfig").addEventListener("click", exportConfig);
document.getElementById("importConfig").addEventListener("click", importConfig);

document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    settings = { ...DEFAULTS, ...imported };
    await chrome.storage.sync.set(settings);
    chrome.runtime.sendMessage({ type: "settingsChanged" });

    document.getElementById("bgTabsEnabled").checked = settings.bgTabsEnabled;
    document.getElementById("searchEnabled").checked = settings.searchEnabled;
    document.getElementById("searchAll").checked = settings.searchAll || false;

    const tp = settings.tabPlacement || "next";
    document.querySelectorAll("#tabPlacementCtrl .seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.val === tp);
    });

    const on = settings.searchEnabled;
    document.getElementById("enginesSection").style.opacity = on ? "1" : "0.4";
    document.getElementById("enginesSection").style.pointerEvents = on ? "auto" : "none";
    renderEngines();
  } catch {
    // malformed file — silently ignore
  }
  e.target.value = "";
});

load().then(() => {
  if (!settings.searchEnabled) {
    document.getElementById("enginesSection").style.opacity = "0.4";
    document.getElementById("enginesSection").style.pointerEvents = "none";
  }
});
