// BackgroundSearch — Content Script
// Tracks Shift key state and relays it to the service worker so that
// holding Shift can invert the force-background default.

(function () {
  let shiftHeld = false;

  document.addEventListener("keydown", (e) => {
    if (e.key === "Shift" && !shiftHeld) {
      shiftHeld = true;
      chrome.runtime.sendMessage({ type: "modifierState", shift: true }).catch(() => {});
    }
  }, true);

  document.addEventListener("keyup", (e) => {
    if (e.key === "Shift" && shiftHeld) {
      shiftHeld = false;
      chrome.runtime.sendMessage({ type: "modifierState", shift: false }).catch(() => {});
    }
  }, true);

  // Reset on blur (user may release Shift while window is not focused)
  window.addEventListener("blur", () => {
    if (shiftHeld) {
      shiftHeld = false;
      chrome.runtime.sendMessage({ type: "modifierState", shift: false }).catch(() => {});
    }
  });
})();
