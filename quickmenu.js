// BackgroundSearch — Quick Menu
// Floating engine buttons near text selection. Injected as Shadow DOM.

(function () {
  let enabled = false;
  let engines = [];
  let enabledIds = [];
  let menuEl = null;
  let shadow = null;

  async function loadConfig() {
    const resp = await fetch(chrome.runtime.getURL("engines.json"));
    engines = await resp.json();
    const data = await chrome.storage.sync.get({
      quickMenu: false,
      enabledEngines: ["google"],
      customEngines: [],
      engineOrder: [],
    });
    enabled = data.quickMenu;
    enabledIds = data.enabledEngines;
    const custom = data.customEngines || [];
    const all = [...engines, ...custom];
    const order = data.engineOrder || [];
    if (order.length > 0) {
      const byId = new Map(all.map((e) => [e.id, e]));
      engines = [];
      for (const id of order) {
        if (byId.has(id)) { engines.push(byId.get(id)); byId.delete(id); }
      }
      for (const e of byId.values()) engines.push(e);
    } else {
      engines = all;
    }
  }

  function createMenu() {
    if (menuEl) return;
    menuEl = document.createElement("bs-quickmenu");
    shadow = menuEl.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host { position: fixed; z-index: 2147483647; pointer-events: none; }
        .qm { display: none; position: absolute; background: #1e1e2e; border: 1px solid #313244;
               border-radius: 8px; padding: 4px; gap: 2px; flex-wrap: wrap; max-width: 200px;
               box-shadow: 0 4px 16px rgba(0,0,0,0.4); pointer-events: auto; }
        .qm.show { display: flex; }
        .qm-btn { width: 28px; height: 28px; border: none; border-radius: 4px; cursor: pointer;
                   font-size: 10px; font-weight: 700; color: #11111b; display: flex;
                   align-items: center; justify-content: center; transition: opacity 0.15s; }
        .qm-btn:hover { opacity: 0.75; }
        .qm-btn img { width: 16px; height: 16px; border-radius: 2px; }
      </style>
      <div class="qm" id="menu"></div>
    `;
    document.documentElement.appendChild(menuEl);
  }

  function showMenu(x, y, selectedText) {
    if (!menuEl) createMenu();
    const menu = shadow.getElementById("menu");
    menu.innerHTML = "";

    const active = engines.filter((e) => enabledIds.includes(e.id)).slice(0, 12);
    for (const engine of active) {
      const btn = document.createElement("button");
      btn.className = "qm-btn";
      btn.title = engine.name;
      btn.style.background = engine.color || "#45475a";

      try {
        const domain = new URL(engine.url.replace("%s", "test")).hostname;
        btn.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=16" onerror="this.parentElement.textContent='${engine.name.charAt(0)}'">`;
      } catch {
        btn.textContent = engine.name.charAt(0);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const url = engine.url.replace("%s", encodeURIComponent(selectedText));
        chrome.runtime.sendMessage({ type: "quickMenuSearch", url, engineId: engine.id });
        hideMenu();
      });
      menu.appendChild(btn);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mx = Math.min(x, vw - 220);
    const my = Math.min(y + 10, vh - 80);
    menuEl.style.left = mx + "px";
    menuEl.style.top = my + "px";
    menu.classList.add("show");
  }

  function hideMenu() {
    if (!shadow) return;
    const menu = shadow.getElementById("menu");
    if (menu) menu.classList.remove("show");
  }

  document.addEventListener("mouseup", (e) => {
    if (!enabled) return;
    if (e.button !== 0) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 0) {
        showMenu(e.clientX, e.clientY, text);
      } else {
        hideMenu();
      }
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (!menuEl) return;
    if (!menuEl.contains(e.target)) hideMenu();
  });

  document.addEventListener("scroll", hideMenu, true);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.quickMenu) enabled = changes.quickMenu.newValue;
    if (changes.enabledEngines) enabledIds = changes.enabledEngines.newValue;
  });

  loadConfig();
})();
