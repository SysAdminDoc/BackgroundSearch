// BackgroundSearch â€” Quick Menu
// Floating engine buttons near text selection. Injected as Shadow DOM.

(function () {
  const api = globalThis.browser || globalThis.chrome;

  let enabled = false;
  let engines = [];
  let enabledIds = [];
  let menuEl = null;
  let shadow = null;

  async function loadConfig() {
    engines = await api.runtime.sendMessage({ type: 'getEngines' });
    if (!Array.isArray(engines)) throw new Error('Could not load search engines.');
    const data = await api.storage.sync.get({
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
    const style = document.createElement("style");
    style.textContent = `
      :host { position: fixed; z-index: 2147483647; pointer-events: none; }
      .qm { display: none; position: absolute; width: max-content; background: #1e1e2e; border: 1px solid #45475a;
             border-radius: 8px; padding: 6px; gap: 4px; flex-wrap: wrap; max-width: 280px;
             box-shadow: 0 4px 16px rgba(0,0,0,0.4); pointer-events: auto; }
      .qm.show { display: flex; }
      .qm-btn { min-width: 28px; min-height: 32px; border: 1px solid #45475a; border-radius: 4px; cursor: pointer;
                 font: 12px system-ui,sans-serif; color: #e5edff; background: #273146; display: flex; padding: 4px 8px; gap: 6px;
                 align-items: center; justify-content: center; transition: opacity 0.15s; }
      .qm-btn:hover { opacity: 0.75; }
      .qm-btn img { width: 16px; height: 16px; border-radius: 2px; }
    `;
    const menu = document.createElement("div");
    menu.className = "qm";
    menu.id = "menu";
    shadow.append(style, menu);
    document.documentElement.appendChild(menuEl);
  }

  function showMenu(x, y, selectedText) {
    if (!menuEl) createMenu();
    const menu = shadow.getElementById("menu");
    menu.replaceChildren();

    const active = engines.filter((e) => enabledIds.includes(e.id)).slice(0, 12);
    for (const engine of active) {
      const btn = document.createElement("button");
      btn.className = "qm-btn";
      btn.title = engine.name;
      btn.setAttribute('aria-label', `Search ${engine.name}`);

      try {
        const domain = new URL(engine.url.replace("%s", "test")).hostname;
        const img = document.createElement("img");
        img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        img.addEventListener("error", () => {
          img.remove();
        }, { once: true });
        btn.appendChild(img);
      } catch {
        // The engine name remains available without an icon.
      }
      btn.appendChild(document.createTextNode(engine.name));

      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const result = await api.runtime.sendMessage({ type: "quickMenuSearch", text: selectedText, engineId: engine.id });
          if (!result?.ok) throw new Error(result?.error || 'Search could not open.');
          hideMenu();
        } catch (error) {
          btn.title = error.message;
          btn.textContent = '!';
          console.error('BackgroundSearch could not open search', error);
        }
      });
      menu.appendChild(btn);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    menu.classList.add('show');
    const mx = Math.max(4, Math.min(x, vw - menu.offsetWidth - 8));
    const my = Math.max(4, Math.min(y + 10, vh - menu.offsetHeight - 8));
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

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName && areaName !== "sync") return;
    if (['quickMenu', 'enabledEngines', 'customEngines', 'engineOrder'].some(key => key in changes)) {
      hideMenu();
      loadConfig().catch(error => console.error('BackgroundSearch settings could not load', error));
    }
  });

  loadConfig().catch(() => {});
})();
