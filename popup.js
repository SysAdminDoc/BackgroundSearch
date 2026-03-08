// BackgroundSearch v2.0.0 — Popup Settings

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
  { id: "imdb",         name: "IMDb",           url: "https://www.imdb.com/find/?q=%s",                     color: "#f5c518" },
];

const DEFAULTS = {
  bgTabsEnabled: true,
  searchEnabled: true,
  enabledEngines: ["google"],
};

let settings = {};

async function load() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  settings = data;

  document.getElementById("bgTabsEnabled").checked = settings.bgTabsEnabled;
  document.getElementById("searchEnabled").checked = settings.searchEnabled;

  renderEngines();
}

function renderEngines(filter = "") {
  const list = document.getElementById("engineList");
  list.innerHTML = "";
  const lower = filter.toLowerCase();

  for (const engine of ENGINES) {
    if (lower && !engine.name.toLowerCase().includes(lower)) continue;

    const row = document.createElement("div");
    row.className = "toggle-row";

    const initial = engine.name.charAt(0);
    const checked = settings.enabledEngines.includes(engine.id) ? "checked" : "";

    row.innerHTML = `
      <div class="toggle-label">
        <div class="icon" style="background:${engine.color}">${initial}</div>
        <span>${engine.name}</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" data-engine="${engine.id}" ${checked}>
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
    `;

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
  settings.enabledEngines = ENGINES.map((e) => e.id);
  renderEngines(document.getElementById("filterInput").value);
  await save();
});

document.getElementById("disableAll").addEventListener("click", async () => {
  settings.enabledEngines = [];
  renderEngines(document.getElementById("filterInput").value);
  await save();
});

load().then(() => {
  if (!settings.searchEnabled) {
    document.getElementById("enginesSection").style.opacity = "0.4";
    document.getElementById("enginesSection").style.pointerEvents = "none";
  }
});
