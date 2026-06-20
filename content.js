// BackgroundSearch — Content Script
// 1. Tracks Shift key state for modifier override
// 2. Normalizes middle-click behavior when enabled

(function () {
  let shiftHeld = false;
  let middleClickEnabled = false;

  // Load middle-click setting
  chrome.storage.sync.get({ middleClickCapture: false }, (data) => {
    middleClickEnabled = data.middleClickCapture;
  });

  // Listen for setting changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.middleClickCapture) {
      middleClickEnabled = changes.middleClickCapture.newValue;
    }
  });

  // ── Shift Modifier Tracking ──

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

  // ── Middle-Click Capture ──
  // Prevents sites from hijacking middle-click on links.
  // When enabled, ensures middle-click on <a> tags opens the href in a
  // new background tab via the extension, overriding any JS handlers the
  // site may have attached (e.g., SPAs that use pushState on all clicks).

  document.addEventListener("auxclick", (e) => {
    if (!middleClickEnabled) return;
    if (e.button !== 1) return; // only middle-click

    // Walk up to find nearest <a> with an href
    let link = e.target;
    while (link && link.tagName !== "A") link = link.parentElement;
    if (!link || !link.href) return;

    // Prevent the site's default and JS handlers from interfering
    e.preventDefault();
    e.stopPropagation();

    // Ask the background to open the tab (respects force-background + site rules)
    chrome.runtime.sendMessage({
      type: "openTab",
      url: link.href,
    }).catch(() => {});
  }, true);
})();
