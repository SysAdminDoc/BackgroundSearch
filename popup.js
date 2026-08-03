// BackgroundSearch v2.7.0 â€” Popup Settings

const api = globalThis.browser || globalThis.chrome;

let ENGINES = [];

const DEFAULTS = {
  _schemaVersion: 1,
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
  themeMode: "system",
  siteRules: [],
  engineOrder: [],
  middleClickCapture: false,
  quickMenu: false,
};

let settings = {};

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode || "system";
}

function notifySettingsChanged() {
  api.runtime.sendMessage({ type: "settingsChanged" }).catch(() => {});
}

async function load() {
  const resp = await fetch(api.runtime.getURL("engines.json"));
  ENGINES = await resp.json();

  const data = await api.storage.sync.get(DEFAULTS);
  settings = data;

  document.getElementById("bgTabsEnabled").checked = settings.bgTabsEnabled;
  document.getElementById("searchEnabled").checked = settings.searchEnabled;
  document.getElementById("searchAll").checked = settings.searchAll || false;
  document.getElementById("middleClickCapture").checked = settings.middleClickCapture || false;
  document.getElementById("quickMenu").checked = settings.quickMenu || false;

  const tabPlacement = settings.tabPlacement || "next";
  document.querySelectorAll("#tabPlacementCtrl .seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.val === tabPlacement);
  });

  const themeMode = settings.themeMode || "system";
  applyTheme(themeMode);
  document.querySelectorAll("#themeCtrl .seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.val === themeMode);
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

function getOrderedEngines() {
  const all = [...ENGINES, ...(settings.customEngines || [])];
  const order = settings.engineOrder || [];
  if (order.length === 0) return all;
  const byId = new Map(all.map((e) => [e.id, e]));
  const ordered = [];
  for (const id of order) {
    if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); }
  }
  // Append any engines not in the order list (new engines)
  for (const e of byId.values()) ordered.push(e);
  return ordered;
}

function renderEngines(filter = "") {
  const list = document.getElementById("engineList");
  list.replaceChildren();
  const lower = filter.toLowerCase();
  const allEngines = getOrderedEngines();
  const groups = settings.engineGroups || [];
  const groupMap = settings.engineGroupMap || {};

  for (const engine of allEngines) {
    if (lower && !engine.name.toLowerCase().includes(lower)) continue;

    const row = document.createElement("div");
    row.className = "toggle-row";
    row.draggable = !lower; // disable drag while filtering
    row.dataset.engineId = engine.id;

    const initial = engine.name.charAt(0);
    const isCustom = engine.id.startsWith("custom_");
    const isFg = (settings.fgEngines || []).includes(engine.id);
    const isWin = (settings.windowEngines || []).includes(engine.id);
    const targetLabel = isWin ? "WIN" : isFg ? "FG" : "BG";
    const badgeClass = isWin ? "bg-badge win" : isFg ? "bg-badge fg" : "bg-badge";

    const faviconSrc = getFaviconUrl(engine.url);

    const toggleLabel = document.createElement("div");
    toggleLabel.className = "toggle-label";

    const fallbackIcon = document.createElement("div");
    fallbackIcon.className = "icon";
    fallbackIcon.style.background = engine.color || "#45475a";
    fallbackIcon.textContent = initial;

    if (faviconSrc) {
      const img = document.createElement("img");
      img.className = "icon-img";
      img.src = faviconSrc;
      img.width = 20;
      img.height = 20;
      img.style.borderRadius = "4px";
      fallbackIcon.style.display = "none";
      img.addEventListener("error", () => {
        img.style.display = "none";
        fallbackIcon.style.display = "flex";
      }, { once: true });
      toggleLabel.append(img, fallbackIcon);
    } else {
      toggleLabel.appendChild(fallbackIcon);
    }

    const nameSpan = document.createElement("span");
    nameSpan.textContent = engine.name;
    toggleLabel.appendChild(nameSpan);
    row.appendChild(toggleLabel);

    let groupSelect = null;
    if (groups.length > 0) {
      groupSelect = document.createElement("select");
      groupSelect.className = "group-select";
      groupSelect.dataset.engine = engine.id;
      groupSelect.title = "Assign group";
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "-";
      groupSelect.appendChild(emptyOption);
      const curGroup = groupMap[engine.id] || "";
      for (const g of groups) {
        const option = document.createElement("option");
        option.value = g.id;
        option.textContent = g.name;
        option.selected = g.id === curGroup;
        groupSelect.appendChild(option);
      }
      row.appendChild(groupSelect);
    }

    const badge = document.createElement("button");
    badge.className = badgeClass;
    badge.title = "Cycle: BG / FG / Window";
    badge.dataset.engine = engine.id;
    badge.textContent = targetLabel;
    row.appendChild(badge);

    let deleteBtn = null;
    if (isCustom) {
      deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.title = "Remove engine";
      deleteBtn.setAttribute("aria-label", `Remove ${engine.name}`);
      deleteBtn.textContent = "x";
      row.appendChild(deleteBtn);
    }

    const toggleSwitch = document.createElement("label");
    toggleSwitch.className = "toggle-switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.engine = engine.id;
    checkbox.checked = settings.enabledEngines.includes(engine.id);
    const track = document.createElement("div");
    track.className = "toggle-track";
    const thumb = document.createElement("div");
    thumb.className = "toggle-thumb";
    toggleSwitch.append(checkbox, track, thumb);
    row.appendChild(toggleSwitch);

    badge.addEventListener("click", () => cycleEngineTarget(engine.id));

    if (isCustom) {
      deleteBtn.addEventListener("click", () => deleteCustomEngine(engine.id));
    }

    if (groupSelect) groupSelect.addEventListener("change", (e) => assignEngineGroup(engine.id, e.target.value));

    checkbox.addEventListener("change", (e) => {
      toggleEngine(engine.id, e.target.checked);
    });

    // Drag-and-drop reorder
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", engine.id);
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const fromId = e.dataTransfer.getData("text/plain");
      const toId = engine.id;
      if (fromId === toId) return;
      await reorderEngine(fromId, toId);
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

const SYNC_QUOTA = 102400;
const SYNC_WARN_THRESHOLD = 0.8;

async function save() {
  try {
    await api.storage.sync.set(settings);
  } catch (err) {
    if (err?.message?.includes("QUOTA")) {
      await api.storage.local.set(settings);
      showToast("Storage full â€” saved locally only", true);
    }
    return;
  }
  const used = await api.storage.sync.getBytesInUse(null);
  if (used > SYNC_QUOTA * SYNC_WARN_THRESHOLD) {
    showToast(`Storage ${Math.round(used / SYNC_QUOTA * 100)}% full`, true);
  }
  notifySettingsChanged();
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

// â”€â”€ Search All & Tab Placement â”€â”€

document.getElementById("searchAll").addEventListener("change", async (e) => {
  settings.searchAll = e.target.checked;
  await save();
});

document.getElementById("middleClickCapture").addEventListener("change", async (e) => {
  settings.middleClickCapture = e.target.checked;
  await save();
});

document.getElementById("quickMenu").addEventListener("change", async (e) => {
  settings.quickMenu = e.target.checked;
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

// â”€â”€ Theme â”€â”€

document.querySelectorAll("#themeCtrl .seg-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll("#themeCtrl .seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    settings.themeMode = btn.dataset.val;
    applyTheme(settings.themeMode);
    await save();
  });
});

// â”€â”€ Custom Engines â”€â”€

const SAFE_PROTOCOLS = ["http:", "https:"];
const VALID_SETTINGS_KEYS = new Set(Object.keys(DEFAULTS));

function isValidEngineUrl(url) {
  if (!url || !url.includes("%s")) return false;
  try {
    const test = new URL(url.replace("%s", "test"));
    return SAFE_PROTOCOLS.includes(test.protocol);
  } catch { return false; }
}

function sanitizeImport(imported) {
  const clean = {};
  for (const key of Object.keys(imported)) {
    if (!VALID_SETTINGS_KEYS.has(key)) continue;
    clean[key] = imported[key];
  }
  if (Array.isArray(clean.customEngines)) {
    clean.customEngines = clean.customEngines.filter(
      (e) => e && typeof e.name === "string" && isValidEngineUrl(e.url)
    );
  }
  return clean;
}

function showToast(msg, isError) {
  let toast = document.getElementById("bs-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "bs-toast";
    toast.style.cssText = "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:6px;font-size:11px;z-index:999;transition:opacity 0.3s;pointer-events:none;";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = isError ? "var(--red)" : "var(--green)";
  toast.style.color = "var(--crust)";
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = "0"; }, 2500);
}

function getFaviconUrl(engineUrl) {
  try {
    const domain = new URL(engineUrl.replace("%s", "test")).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch { return null; }
}

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
  if (!isValidEngineUrl(url)) { urlInput.style.borderColor = "var(--red)"; valid = false; }
  if (!valid) {
    if (url && !isValidEngineUrl(url)) showToast("URL must be https:// with %s placeholder", true);
    return;
  }

  nameInput.style.borderColor = "";
  urlInput.style.borderColor = "";

  const method = document.getElementById("newEngineMethod").value;
  const engine = {
    id: `custom_${Date.now()}`,
    name,
    url,
    color: randomEngineColor(),
  };
  if (method === "POST") engine.method = "POST";

  if (!settings.customEngines) settings.customEngines = [];
  settings.customEngines.push(engine);
  if (!settings.enabledEngines.includes(engine.id)) {
    settings.enabledEngines.push(engine.id);
  }

  await save();
  nameInput.value = "";
  urlInput.value = "";
  document.getElementById("newEngineMethod").value = "GET";
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
  document.getElementById("openSearchForm").classList.remove("open");
});

document.getElementById("toggleOpenSearch").addEventListener("click", () => {
  document.getElementById("openSearchForm").classList.toggle("open");
  document.getElementById("addEngineForm").classList.remove("open");
});

document.getElementById("addEngineBtn").addEventListener("click", addCustomEngine);

document.getElementById("importOpenSearchBtn").addEventListener("click", async () => {
  const urlInput = document.getElementById("openSearchUrl");
  const url = urlInput.value.trim();
  if (!url) { urlInput.style.borderColor = "var(--red)"; return; }
  urlInput.style.borderColor = "";

  try {
    const resp = await fetch(url);
    const text = await resp.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const name = doc.querySelector("ShortName")?.textContent?.trim();
    const urlNode = doc.querySelector('Url[type="text/html"]');
    const template = urlNode?.getAttribute("template");

    if (!name || !template) { showToast("Invalid OpenSearch descriptor", true); return; }

    const engineUrl = template.replace("{searchTerms}", "%s");
    if (!isValidEngineUrl(engineUrl)) { showToast("Engine URL not valid", true); return; }

    const engine = {
      id: `custom_${Date.now()}`,
      name,
      url: engineUrl,
      color: randomEngineColor(),
    };

    if (!settings.customEngines) settings.customEngines = [];
    settings.customEngines.push(engine);
    if (!settings.enabledEngines.includes(engine.id)) {
      settings.enabledEngines.push(engine.id);
    }

    await save();
    urlInput.value = "";
    document.getElementById("openSearchForm").classList.remove("open");
    renderEngines(document.getElementById("filterInput").value);
    showToast(`Imported "${name}"`, false);
  } catch {
    showToast("Failed to fetch OpenSearch XML", true);
  }
});

document.getElementById("openSearchUrl")?.addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});

document.getElementById("newEngineName").addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});

document.getElementById("newEngineUrl").addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});

// â”€â”€ Engine Target Cycle (BG -> FG -> WIN -> BG) â”€â”€

async function cycleEngineTarget(id) {
  const fgEngines = settings.fgEngines || [];
  const winEngines = settings.windowEngines || [];
  const isFg = fgEngines.includes(id);
  const isWin = winEngines.includes(id);

  if (isWin) {
    // WIN -> BG
    settings.windowEngines = winEngines.filter((e) => e !== id);
  } else if (isFg) {
    // FG -> WIN
    settings.fgEngines = fgEngines.filter((e) => e !== id);
    settings.windowEngines = [...winEngines, id];
  } else {
    // BG -> FG
    settings.fgEngines = [...fgEngines, id];
  }
  await save();
  renderEngines(document.getElementById("filterInput").value);
}

// â”€â”€ Drag-to-Reorder â”€â”€

async function reorderEngine(fromId, toId) {
  const ordered = getOrderedEngines().map((e) => e.id);
  const fromIdx = ordered.indexOf(fromId);
  const toIdx = ordered.indexOf(toId);
  if (fromIdx === -1 || toIdx === -1) return;
  ordered.splice(fromIdx, 1);
  ordered.splice(toIdx, 0, fromId);
  settings.engineOrder = ordered;
  await save();
  renderEngines(document.getElementById("filterInput").value);
}

// â”€â”€ Site Rules â”€â”€

function renderSiteRules() {
  const list = document.getElementById("siteRuleList");
  if (!list) return;
  list.replaceChildren();
  const rules = settings.siteRules || [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const row = document.createElement("div");
    row.className = "rule-row";
    const actionLabel = rule.action === "fg" ? "FG" : rule.action === "bg" ? "BG" : "DEF";
    const actionClass = rule.action === "fg" ? "fg" : rule.action === "bg" ? "bg" : "default";
    const pattern = document.createElement("span");
    pattern.className = "rule-pattern";
    pattern.title = rule.pattern;
    pattern.textContent = rule.pattern;
    const type = document.createElement("span");
    type.className = "rule-type-badge";
    type.textContent = rule.type;
    const action = document.createElement("span");
    action.className = `rule-action-badge ${actionClass}`;
    action.textContent = actionLabel;
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.title = "Remove rule";
    deleteBtn.setAttribute("aria-label", "Remove rule");
    deleteBtn.textContent = "x";
    row.append(pattern, type, action, deleteBtn);
    const idx = i;
    deleteBtn.addEventListener("click", () => deleteSiteRule(idx));
    list.appendChild(row);
  }
}

async function addSiteRule() {
  const patternInput = document.getElementById("newRulePattern");
  const typeSelect = document.getElementById("newRuleType");
  const actionSelect = document.getElementById("newRuleAction");
  const pattern = patternInput.value.trim();
  if (!pattern) { patternInput.style.borderColor = "var(--red)"; return; }
  patternInput.style.borderColor = "";

  if (!settings.siteRules) settings.siteRules = [];
  settings.siteRules.push({
    pattern,
    type: typeSelect.value,
    action: actionSelect.value,
  });
  await save();
  patternInput.value = "";
  renderSiteRules();
}

async function deleteSiteRule(index) {
  if (!settings.siteRules) return;
  settings.siteRules.splice(index, 1);
  await save();
  renderSiteRules();
}

document.getElementById("addSiteRuleBtn")?.addEventListener("click", addSiteRule);
document.getElementById("newRulePattern")?.addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});
document.getElementById("newRulePattern")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSiteRule();
});

// â”€â”€ Engine Groups â”€â”€

async function assignEngineGroup(engineId, groupId) {
  if (!settings.engineGroupMap) settings.engineGroupMap = {};
  if (groupId) {
    settings.engineGroupMap[engineId] = groupId;
  } else {
    delete settings.engineGroupMap[engineId];
  }
  await save();
}

function renderGroups() {
  const list = document.getElementById("groupList");
  if (!list) return;
  list.replaceChildren();
  const groups = settings.engineGroups || [];
  for (const group of groups) {
    const row = document.createElement("div");
    row.className = "group-row";
    const name = document.createElement("span");
    name.className = "group-name";
    name.textContent = group.name;
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.title = "Remove group";
    deleteBtn.setAttribute("aria-label", `Remove ${group.name}`);
    deleteBtn.textContent = "x";
    row.append(name, deleteBtn);
    deleteBtn.addEventListener("click", () => deleteGroup(group.id));
    list.appendChild(row);
  }
}

async function addGroup() {
  const input = document.getElementById("newGroupName");
  const name = input.value.trim();
  if (!name) { input.style.borderColor = "var(--red)"; return; }
  input.style.borderColor = "";

  if (!settings.engineGroups) settings.engineGroups = [];
  settings.engineGroups.push({ id: `grp_${Date.now()}`, name });
  await save();
  input.value = "";
  renderGroups();
  renderEngines(document.getElementById("filterInput").value);
}

async function deleteGroup(groupId) {
  settings.engineGroups = (settings.engineGroups || []).filter((g) => g.id !== groupId);
  // Remove group assignments for deleted group
  const map = settings.engineGroupMap || {};
  for (const key of Object.keys(map)) {
    if (map[key] === groupId) delete map[key];
  }
  settings.engineGroupMap = map;
  await save();
  renderGroups();
  renderEngines(document.getElementById("filterInput").value);
}

// â”€â”€ Reset â”€â”€

async function resetSection(section) {
  if (section === "features") {
    settings.bgTabsEnabled = DEFAULTS.bgTabsEnabled;
    settings.searchEnabled = DEFAULTS.searchEnabled;
    settings.searchAll = DEFAULTS.searchAll;
    settings.tabPlacement = DEFAULTS.tabPlacement;
    settings.omniboxEngineId = DEFAULTS.omniboxEngineId;
    settings.themeMode = DEFAULTS.themeMode;
    settings.siteRules = [];
  } else if (section === "engines") {
    settings.enabledEngines = [...DEFAULTS.enabledEngines];
    settings.fgEngines = [];
    settings.windowEngines = [];
    settings.customEngines = [];
    settings.engineGroups = [];
    settings.engineGroupMap = {};
    settings.engineOrder = [];
  }
  await save();
  location.reload();
}

document.getElementById("resetFeatures").addEventListener("click", () => resetSection("features"));
document.getElementById("resetEngines").addEventListener("click", () => resetSection("engines"));

// â”€â”€ Export / Import â”€â”€

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
    const raw = JSON.parse(text);
    const imported = sanitizeImport(raw);
    settings = { ...DEFAULTS, ...imported };
    await api.storage.sync.set(settings);
    notifySettingsChanged();

    document.getElementById("bgTabsEnabled").checked = settings.bgTabsEnabled;
    document.getElementById("searchEnabled").checked = settings.searchEnabled;
    document.getElementById("searchAll").checked = settings.searchAll || false;
    document.getElementById("middleClickCapture").checked = settings.middleClickCapture || false;

    const tp = settings.tabPlacement || "next";
    document.querySelectorAll("#tabPlacementCtrl .seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.val === tp);
    });

    const tm = settings.themeMode || "system";
    applyTheme(tm);
    document.querySelectorAll("#themeCtrl .seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.val === tm);
    });

    const on = settings.searchEnabled;
    document.getElementById("enginesSection").style.opacity = on ? "1" : "0.4";
    document.getElementById("enginesSection").style.pointerEvents = on ? "auto" : "none";
    renderEngines();
    renderGroups();
    renderSiteRules();
    showToast("Config imported", false);
  } catch {
    showToast("Invalid config file", true);
  }
  e.target.value = "";
});

// â”€â”€ Group UI listeners â”€â”€

document.getElementById("addGroupBtn")?.addEventListener("click", addGroup);
document.getElementById("newGroupName")?.addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});
document.getElementById("newGroupName")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addGroup();
});

async function renderTopEngines() {
  const { engineStats = {} } = await api.storage.local.get({ engineStats: {} });
  const all = getOrderedEngines();
  const sorted = Object.entries(engineStats)
    .map(([id, times]) => ({ id, count: times.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const el = document.getElementById("topEngines");
  if (sorted.length === 0) { el.style.display = "none"; return; }
  el.style.display = "flex";
  el.replaceChildren();
  for (const s of sorted) {
    const engine = all.find((e) => e.id === s.id);
    const chip = document.createElement("span");
    chip.className = "stat-chip";
    chip.append(document.createTextNode(engine ? engine.name : s.id));
    const count = document.createElement("span");
    count.className = "stat-count";
    count.textContent = s.count;
    chip.appendChild(count);
    el.appendChild(chip);
  }
}

load().then(() => {
  api.runtime.sendMessage({ type: "resetBadge" }).catch(() => {});
  if (!settings.searchEnabled) {
    document.getElementById("enginesSection").style.opacity = "0.4";
    document.getElementById("enginesSection").style.pointerEvents = "none";
  }
  renderGroups();
  renderSiteRules();
  renderTopEngines();
});
