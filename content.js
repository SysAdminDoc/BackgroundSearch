// BackgroundSearch — Content Script
// Conditionally registers listeners based on enabled features.

(function () {
  let shiftHeld = false;

  function startShiftTracking() {
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

    window.addEventListener("blur", () => {
      if (shiftHeld) {
        shiftHeld = false;
        chrome.runtime.sendMessage({ type: "modifierState", shift: false }).catch(() => {});
      }
    });
  }

  function startMiddleClickCapture() {
    document.addEventListener("auxclick", (e) => {
      if (e.button !== 1) return;
      let link = e.target;
      while (link && link.tagName !== "A") link = link.parentElement;
      if (!link || !link.href) return;
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "openTab", url: link.href }).catch(() => {});
    }, true);
  }

  chrome.storage.sync.get({ bgTabsEnabled: true, middleClickCapture: false }, (data) => {
    if (data.bgTabsEnabled) startShiftTracking();
    if (data.middleClickCapture) startMiddleClickCapture();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.bgTabsEnabled?.newValue && !shiftHeld) startShiftTracking();
    if (changes.middleClickCapture?.newValue) startMiddleClickCapture();
  });
})();
