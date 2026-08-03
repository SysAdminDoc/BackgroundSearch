// BackgroundSearch â€” Content Script
// Conditionally registers listeners based on enabled features.

(function () {
  const api = globalThis.browser || globalThis.chrome;

  let shiftHeld = false;
  let shiftTrackingStarted = false;
  let middleClickCaptureStarted = false;

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
      if (e.button !== 1) return;
      let link = e.target;
      while (link && link.tagName !== "A") link = link.parentElement;
      if (!link || !link.href) return;
      e.preventDefault();
      e.stopPropagation();
      api.runtime.sendMessage({ type: "openTab", url: link.href }).catch(() => {});
    }, true);
  }

  async function init() {
    const data = await api.storage.sync.get({ bgTabsEnabled: true, middleClickCapture: false });
    if (data.bgTabsEnabled) startShiftTracking();
    if (data.middleClickCapture) startMiddleClickCapture();
  }

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName && areaName !== "sync") return;
    if (changes.bgTabsEnabled?.newValue && !shiftHeld) startShiftTracking();
    if (changes.middleClickCapture?.newValue) startMiddleClickCapture();
  });

  init().catch(() => {});
})();
