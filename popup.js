// BackgroundSearch v2.5.0 — Popup Settings

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
};

let settings = {};

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode || "system";
}

async function load() {
  const resp = await fetch(chrome.runtime.getURL("engines.json"));
  ENGINES = await resp.json();

  const data = await chrome.storage.sync.get(DEFAULTS);
  settings = data;

  document.getElementById("bgTabsEnabled").checked = settings.bgTabsEnabled;
  document.getElementById("searchEnabled").checked = settings.searchEnabled;
  document.getElementById("searchAll").checked = settings.searchAll || false;
  document.getElementById("middleClickCapture").checked = settings.middleClickCapture || false;

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
  list.innerHTML = "";
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

    const initial = escHtml(engine.name.charAt(0));
    const name = escHtml(engine.name);
    const checked = settings.enabledEngines.includes(engine.id) ? "checked" : "";
    const isCustom = engine.id.startsWith("custom_");
    const isFg = (settings.fgEngines || []).includes(engine.id);
    const isWin = (settings.windowEngines || []).includes(engine.id);
    const targetLabel = isWin ? "WIN" : isFg ? "FG" : "BG";
    const badgeClass = isWin ? "bg-badge win" : isFg ? "bg-badge fg" : "bg-badge";

    // Group selector (only shown when groups exist)
    let groupHtml = "";
    if (groups.length > 0) {
      const curGroup = groupMap[engine.id] || "";
      let opts = `<option value="">—</option>`;
      for (const g of groups) {
        const sel = g.id === curGroup ? "selected" : "";
        opts += `<option value="${escHtml(g.id)}" ${sel}>${escHtml(g.name)}</option>`;
      }
      groupHtml = `<select class="group-select" data-engine="${engine.id}" title="Assign group">${opts}</select>`;
    }

    const faviconSrc = getFaviconUrl(engine.url);
    const iconHtml = faviconSrc
      ? `<img class="icon-img" src="${faviconSrc}" width="20" height="20" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="border-radius:4px"><div class="icon" style="background:${engine.color};display:none">${initial}</div>`
      : `<div class="icon" style="background:${engine.color}">${initial}</div>`;

    row.innerHTML = `
      <div class="toggle-label">
        ${iconHtml}
        <span>${name}</span>
      </div>
      ${groupHtml}
      <button class="${badgeClass}" title="Cycle: BG / FG / Window" data-engine="${engine.id}">${targetLabel}</button>
      ${isCustom ? `<button class="delete-btn" title="Remove engine" aria-label="Remove ${name}">×</button>` : ""}
      <label class="toggle-switch">
        <input type="checkbox" data-engine="${engine.id}" ${checked}>
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
    `;

    row.querySelector(".bg-badge").addEventListener("click", () => cycleEngineTarget(engine.id));

    if (isCustom) {
      row.querySelector(".delete-btn").addEventListener("click", () => deleteCustomEngine(engine.id));
    }

    const groupSelect = row.querySelector(".group-select");
    if (groupSelect) {
      groupSelect.addEventListener("change", (e) => assignEngineGroup(engine.id, e.target.value));
    }

    row.querySelector("input").addEventListener("change", (e) => {
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
    await chrome.storage.sync.set(settings);
  } catch (err) {
    if (err?.message?.includes("QUOTA")) {
      await chrome.storage.local.set(settings);
      showToast("Storage full — saved locally only", true);
    }
    return;
  }
  const used = await chrome.storage.sync.getBytesInUse(null);
  if (used > SYNC_QUOTA * SYNC_WARN_THRESHOLD) {
    showToast(`Storage ${Math.round(used / SYNC_QUOTA * 100)}% full`, true);
  }
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

document.getElementById("middleClickCapture").addEventListener("change", async (e) => {
  settings.middleClickCapture = e.target.checked;
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

// ── Theme ──

document.querySelectorAll("#themeCtrl .seg-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll("#themeCtrl .seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    settings.themeMode = btn.dataset.val;
    applyTheme(settings.themeMode);
    await save();
  });
});

// ── Custom Engines ──

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
});

document.getElementById("addEngineBtn").addEventListener("click", addCustomEngine);

document.getElementById("newEngineName").addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});

document.getElementById("newEngineUrl").addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});

// ── Engine Target Cycle (BG -> FG -> WIN -> BG) ──

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

// ── Drag-to-Reorder ──

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

// ── Site Rules ──

function renderSiteRules() {
  const list = document.getElementById("siteRuleList");
  if (!list) return;
  list.innerHTML = "";
  const rules = settings.siteRules || [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const row = document.createElement("div");
    row.className = "rule-row";
    const actionLabel = rule.action === "fg" ? "FG" : rule.action === "bg" ? "BG" : "DEF";
    const actionClass = rule.action === "fg" ? "fg" : rule.action === "bg" ? "bg" : "default";
    row.innerHTML = `
      <span class="rule-pattern" title="${escHtml(rule.pattern)}">${escHtml(rule.pattern)}</span>
      <span class="rule-type-badge">${escHtml(rule.type)}</span>
      <span class="rule-action-badge ${actionClass}">${actionLabel}</span>
      <button class="delete-btn" title="Remove rule" aria-label="Remove rule">×</button>
    `;
    const idx = i;
    row.querySelector(".delete-btn").addEventListener("click", () => deleteSiteRule(idx));
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

// ── Engine Groups ──

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
  list.innerHTML = "";
  const groups = settings.engineGroups || [];
  for (const group of groups) {
    const row = document.createElement("div");
    row.className = "group-row";
    row.innerHTML = `
      <span class="group-name">${escHtml(group.name)}</span>
      <button class="delete-btn" title="Remove group" aria-label="Remove ${escHtml(group.name)}">×</button>
    `;
    row.querySelector(".delete-btn").addEventListener("click", () => deleteGroup(group.id));
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

// ── Reset ──

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
    const raw = JSON.parse(text);
    const imported = sanitizeImport(raw);
    settings = { ...DEFAULTS, ...imported };
    await chrome.storage.sync.set(settings);
    chrome.runtime.sendMessage({ type: "settingsChanged" });

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

// ── Group UI listeners ──

document.getElementById("addGroupBtn")?.addEventListener("click", addGroup);
document.getElementById("newGroupName")?.addEventListener("input", (e) => {
  e.target.style.borderColor = "";
});
document.getElementById("newGroupName")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addGroup();
});

load().then(() => {
  chrome.runtime.sendMessage({ type: "resetBadge" }).catch(() => {});
  if (!settings.searchEnabled) {
    document.getElementById("enginesSection").style.opacity = "0.4";
    document.getElementById("enginesSection").style.pointerEvents = "none";
  }
  renderGroups();
  renderSiteRules();
});
