// Force Background Tab v1.0.0
// Forces all new tabs to open in the background without stealing focus.

let enabled = true;
let lastActiveTabId = null;
let lastActiveWindowId = null;
let recentlyCreatedTabs = new Set();

// Track the currently active tab at all times
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (recentlyCreatedTabs.has(activeInfo.tabId)) {
    // This activation was caused by a new tab — snap back
    recentlyCreatedTabs.delete(activeInfo.tabId);
    if (enabled && lastActiveTabId !== null) {
      chrome.tabs.update(lastActiveTabId, { active: true }).catch(() => {});
    }
  } else {
    // Normal user-driven tab switch — update tracking
    lastActiveTabId = activeInfo.tabId;
    lastActiveWindowId = activeInfo.windowId;
  }
});

// When a new tab is created, mark it so onActivated can handle the snap-back
chrome.tabs.onCreated.addListener((tab) => {
  if (enabled && tab.active) {
    recentlyCreatedTabs.add(tab.id);
    // Fallback: clear from set after a short delay in case onActivated doesn't fire
    setTimeout(() => recentlyCreatedTabs.delete(tab.id), 500);
  }
});

// Clean up tracking when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  recentlyCreatedTabs.delete(tabId);
  if (tabId === lastActiveTabId) {
    lastActiveTabId = null;
  }
});

// Toggle on/off via toolbar icon click
chrome.action.onClicked.addListener(async () => {
  enabled = !enabled;
  await updateIcon();
});

// Initialize: get the current active tab and set icon
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      lastActiveTabId = tab.id;
      lastActiveWindowId = tab.windowId;
    }
  } catch {}
  await updateIcon();
}

async function updateIcon() {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext("2d");

  // Draw tab shape
  const color = enabled ? "#89b4fa" : "#585b70";
  const bgColor = enabled ? "#1e1e2e" : "#313244";

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(8, 28, 112, 92, 8);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(12, 32, 40, 16, [6, 6, 0, 0]);
  ctx.fill();

  // Arrow pointing down-left (background indicator)
  ctx.strokeStyle = color;
  ctx.lineWidth = enabled ? 10 : 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(95, 50);
  ctx.lineTo(70, 95);
  ctx.lineTo(45, 70);
  ctx.stroke();

  // Arrowhead
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(70, 95);
  ctx.lineTo(55, 82);
  ctx.lineTo(68, 78);
  ctx.closePath();
  ctx.fill();

  const sizes = [16, 32, 48, 128];
  const imageData = {};
  for (const size of sizes) {
    const sCanvas = new OffscreenCanvas(size, size);
    const sCtx = sCanvas.getContext("2d");
    sCtx.drawImage(canvas, 0, 0, size, size);
    imageData[size] = sCtx.getImageData(0, 0, size, size);
  }

  await chrome.action.setIcon({ imageData });
  await chrome.action.setTitle({
    title: `Force Background Tab: ${enabled ? "ON" : "OFF"}`,
  });
}
