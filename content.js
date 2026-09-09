// BackgroundSearch â€” Content Script
// Conditionally registers listeners based on enabled features.

(function () {
  const api = globalThis.browser || globalThis.chrome;

  let shiftHeld = false;
  let shiftTrackingStarted = false;
  let middleClickCaptureStarted = false;
  let middleClickEnabled = false;

  function startShiftTracking() {
    if (shiftTrackingStarted) return;
    shiftTrackingStarted = true;

    document.addEventListener("keydown", (e) => {
      if (e.key === "Shift" && !shiftHeld) {
        shiftHeld = true;
        api.runtime.sendMessage({ type: "modifierState", shift: true }).catch(() => {});
      }
    }, true);

    document.addEventListener("keyup", (e) => {
      if (e.key === "Shift" && shiftHeld) {
        shiftHeld = false;
        api.runtime.sendMessage({ type: "modifierState", shift: false }).catch(() => {});
      }
    }, true);

    window.addEventListener("blur", () => {
      if (shiftHeld) {
        shiftHeld = false;
        api.runtime.sendMessage({ type: "modifierState", shift: false }).catch(() => {});
      }
    });
  }

  function startMiddleClickCapture() {
    if (middleClickCaptureStarted) return;
    middleClickCaptureStarted = true;

    document.addEventListener("auxclick", (e) => {
      if (!middleClickEnabled || e.button !== 1) return;
      let link = e.target;
      while (link && link.tagName !== "A") link = link.parentElement;
      if (!link || !link.href) return;
      try { if (!['http:', 'https:'].includes(new URL(link.href).protocol)) return; } catch { return; }
      e.preventDefault();
      e.stopPropagation();
      api.runtime.sendMessage({ type: "openTab", url: link.href }).catch(() => {});
    }, true);
  }

  async function init() {
    const data = await api.storage.sync.get({ bgTabsEnabled: true, middleClickCapture: false });
    startShiftTracking();
    middleClickEnabled = data.middleClickCapture;
    if (middleClickEnabled) startMiddleClickCapture();
  }

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName && areaName !== "sync") return;
    if (changes.bgTabsEnabled?.newValue && !shiftHeld) startShiftTracking();
    if (changes.middleClickCapture) {
      middleClickEnabled = changes.middleClickCapture.newValue === true;
      if (middleClickEnabled) startMiddleClickCapture();
    }
  });

  init().catch(() => {});
})();
