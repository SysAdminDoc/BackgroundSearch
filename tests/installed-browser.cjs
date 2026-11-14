const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
const stage = path.join(root, 'dist', `BackgroundSearch-v${version}-chrome`);
const output = path.join(root, 'test-results', `installed-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
const report = { version, browser: '', isolatedHeadless: true, checks: [], pageErrors: [], network: [], blockedConnections: [], destinations: [] };
const fixture = `<!doctype html><html lang="en"><meta charset="utf-8"><title>A quieter way to browse</title>
<style>body{margin:0;background:#101826;color:#e9eefb;font:18px/1.7 system-ui}main{max-width:790px;margin:65px auto;padding:0 30px}small{font-size:12px;color:#8fc2ff;letter-spacing:2px}h1{font-size:42px;line-height:1.2;margin:20px 0}p{color:#c8d5e9}a{color:#8fc2ff}.card{padding:28px;border:1px solid #354054;border-radius:12px;background:#172234;margin-top:36px}</style>
<main><small>LOCAL DEMONSTRATION PAGE</small><h1>A quieter way to browse.</h1><p>Read an article. Look up something unfamiliar. Keep the original page right where you left it.</p><div class="card"><p>Select a topic to explore:</p><p id="selection">CSS grid layout</p><a id="new-tab" target="_blank" href="/next">Read the next page</a></div></main></html>`;
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html'); response.setHeader('Access-Control-Allow-Origin', '*'); response.end(fixture);
});
server.on('connect', (request, socket) => {
  report.blockedConnections.push(request.url);
  socket.on('error', error => {
    if (error.code !== 'ECONNRESET') { report.proxyError = error.message; process.exitCode = 1; }
  });
  socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
});
let context;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, label) {
  for (let tries = 0; tries < 50; tries++) { if (await check()) return; await delay(100); }
  throw new Error(label);
}
function passed(label) { report.checks.push(label); }
async function selectText(page) {
  await page.locator('#selection').click();
  const rect = await page.locator('#selection').boundingBox();
  await page.mouse.move(rect.x + 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + 131, rect.y + rect.height / 2, { steps: 16 });
  await page.mouse.up();
  await waitFor(() => page.locator('bs-quickmenu').count(), 'Quick Menu did not appear');
  await delay(250);
}
async function screenshot(page, name) { await delay(300); await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' }); }

(async () => {
  for (const name of ['background.js', 'content.js', 'quickmenu.js', 'popup.html', 'popup.js', 'sidepanel.html', 'sidepanel.js', 'privacy.html', 'INSTALL.html']) {
    assert.equal(fs.readFileSync(path.join(stage, name), 'utf8'), fs.readFileSync(path.join(root, name), 'utf8'), `Stale packaged file: ${name}`);
  }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  context = await chromium.launchPersistentContext(path.join(output, 'owned-profile'), {
    headless: false, args: ['--headless=new', `--disable-extensions-except=${stage}`, `--load-extension=${stage}`],
    viewport: { width: 400, height: 600 }, colorScheme: 'dark', deviceScaleFactor: 1,
    proxy: { server: origin, bypass: '127.0.0.1' },
  });
  report.browser = context.browser().version();
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('chrome-extension:')) return route.continue();
    if (/^https:\/\/(www\.google\.com\/search|github\.com\/search|www\.youtube\.com\/results)/.test(url)) {
      report.network.push({ url, method: route.request().method(), fixtureResponse: true });
      return route.fulfill({ contentType: 'text/html', body: '<title>Owned search-result fixture</title><p>Search URL received by the local test harness.</p>' });
    }
    return route.abort();
  });
  context.on('page', page => page.on('pageerror', error => report.pageErrors.push({ url: page.url(), message: error.message })));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionOrigin = `chrome-extension://${new URL(worker.url()).host}`;
  const popup = await context.newPage();
  await popup.goto(`${extensionOrigin}/popup.html`);
  await popup.locator('[data-engine-id="google"]').waitFor();
  assert.equal(await popup.locator('#engineList .toggle-row').count(), 29);
  assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  passed('Installed package loads all 29 engines without horizontal overflow');
  for (const id of ['github', 'youtube', 'duckduckgo']) {
    await popup.locator('#filterInput').fill(id === 'duckduckgo' ? 'DuckDuckGo' : id);
    await popup.locator(`[data-engine-id="${id}"] .toggle-switch`).click();
  }
  await popup.locator('#filterInput').fill('');
  await popup.locator('#quickMenu').locator('..').click();
  await waitFor(() => worker.evaluate(async () => (await chrome.storage.sync.get('quickMenu')).quickMenu), 'Quick Menu setting was not saved');
  await popup.evaluate(() => window.scrollTo(0, 0));
  await screenshot(popup, 'settings-dark');
  await popup.locator('#advancedSettings summary').click();
  await popup.locator('#themeCtrl [data-val="light"]').click();
  await popup.locator('#advancedSettings summary').click();
  await popup.evaluate(() => window.scrollTo(0, 0));
  await screenshot(popup, 'settings-light');
  await popup.locator('#advancedSettings summary').click();
  await popup.locator('#themeCtrl [data-val="dark"]').click();
  await popup.locator('#middleClickCapture').locator('..').click();
  await popup.locator('#newRulePattern').fill('*.example.org');
  await popup.locator('#addSiteRuleBtn').click();
  assert.equal(await popup.locator('#siteRuleList .rule-row').count(), 1);
  await screenshot(popup, 'advanced-settings');
  passed('Engine choices, themes and site rules save through their real controls');

  const page = await context.newPage();
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto(origin);
  await delay(550);
  await page.bringToFront();
  await waitFor(() => worker.evaluate(async url => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].url === url, origin + '/'), 'Reading tab was not selected');
  await selectText(page);
  await screenshot(page, 'quick-menu');
  const menu = await page.locator('bs-quickmenu').boundingBox();
  await page.mouse.click(menu.x + 18, menu.y + 18);
  const searchTabs = () => worker.evaluate(async () => (await chrome.tabs.query({})).filter(tab => tab.url?.startsWith('https://www.google.com/search')));
  await waitFor(async () => (await searchTabs()).length > 0, 'Quick Menu did not create a provider tab');
  const searchUrl = new URL((await searchTabs())[0].url);
  report.destinations.push(searchUrl.href);
  assert.ok(searchUrl.searchParams.get('q')?.trim());
  const activeAfterQuick = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].url);
  assert.equal(activeAfterQuick, origin + '/');
  passed('Real Quick Menu click opens a provider URL and preserves the reading tab');
  await popup.locator('[data-engine-id="google"] .bg-badge').click();
  await waitFor(() => worker.evaluate(async () => (await chrome.storage.sync.get('fgEngines')).fgEngines?.includes('google')), 'Foreground choice was not saved');
  await page.bringToFront();
  await selectText(page);
  const foregroundMenu = await page.locator('bs-quickmenu').boundingBox();
  await page.mouse.click(foregroundMenu.x + 18, foregroundMenu.y + 18);
  await delay(400);
  report.foregroundCheck = await worker.evaluate(async () => ({ settings: await chrome.storage.sync.get(['fgEngines']), tabs: (await chrome.tabs.query({})).map(({id,url,active,windowId}) => ({id,url,active,windowId})) }));
  assert.ok((await worker.evaluate(async () => (await chrome.tabs.query({active:true,currentWindow:true}))[0].url)).startsWith('https://www.google.com/search'), 'FG result lost focus');
  passed('An explicit foreground engine target overrides the background-tab default');

  await popup.locator('#middleClickCapture').locator('..').click();
  await waitFor(() => worker.evaluate(async () => (await chrome.storage.sync.get('middleClickCapture')).middleClickCapture === false), 'Middle capture did not disable');
  await delay(200);
  const intercepted = await page.evaluate(() => {
    const event = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
    document.getElementById('new-tab').dispatchEvent(event); return event.defaultPrevented;
  });
  assert.equal(intercepted, false);
  passed('Turning off middle-click capture restores native link handling on an already-open page');

  const activeTabUrl = () => worker.evaluate(async () => (await chrome.tabs.query({})).filter(tab => tab.active).map(tab => tab.url || tab.pendingUrl).join(' '));
  await page.bringToFront();
  await page.locator('#new-tab').click();
  await waitFor(() => worker.evaluate(async url => (await chrome.tabs.query({})).some(tab => (tab.url || tab.pendingUrl) === url), origin + '/next'), 'Link did not open its tab');
  await delay(500);
  assert.equal(await activeTabUrl(), origin + '/', 'A link opened in its own tab took focus from the reading page');
  passed('A link that opens its own tab stays behind the reading page');
  const browserSession = await context.browser().newBrowserCDPSession();
  await browserSession.send('Target.createTarget', { url: 'chrome://newtab/' });
  await waitFor(async () => /^chrome:\/\/(newtab|new-tab-page)\//.test(await activeTabUrl()), 'New Tab page never became the active tab');
  await delay(500);
  assert.match(await activeTabUrl(), /^chrome:\/\/(newtab|new-tab-page)\/$/, 'The New Tab page was pushed into the background');
  passed('A New Tab page the browser opens keeps focus');
  for (const extra of context.pages()) if (/^chrome:\/\/(newtab|new-tab-page)\/|\/next$/.test(extra.url())) await extra.close();
  await browserSession.detach();
  await worker.evaluate(() => loadSettings());
  assert.equal(await worker.evaluate(() => parseBang('!yt tabs').engine.id), 'youtube');
  assert.equal(await worker.evaluate(() => parseBang('!gh tabs').engine.id), 'github');
  passed('Documented short bang aliases resolve in the installed worker');

  const exported = popup.waitForEvent('download');
  await popup.locator('#exportConfig').click();
  const download = await exported;
  await download.saveAs(path.join(output, 'exported-test-settings.json'));
  const config = JSON.parse(fs.readFileSync(path.join(output, 'exported-test-settings.json')));
  assert.ok(config.enabledEngines.includes('github'));
  await popup.locator('#importFile').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"enabledEngines":"broken"}') });
  await waitFor(async () => (await popup.locator('#bs-toast').textContent()).includes('Invalid config'), 'Malformed import was not rejected');
  assert.ok((await worker.evaluate(async () => (await chrome.storage.sync.get('enabledEngines')).enabledEngines)).includes('github'));
  passed('Export creates a real JSON download; malformed import leaves saved settings intact');

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 320, height: 620 });
  await panel.goto(`${extensionOrigin}/sidepanel.html`);
  await panel.locator('#engineSelect option').first().waitFor({ state: 'attached' });
  assert.equal(await panel.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  let historyCount = 0;
  for (const [query, engine] of [['CSS grid layout', 'google'], ['browser extensions', 'github'], ['browser tab tips', 'youtube']]) {
    await panel.locator('#query').fill(query);
    await panel.locator('#engineSelect').selectOption(engine);
    await panel.locator('#searchBtn').click();
    historyCount++;
    await waitFor(async () => (await panel.locator('.history-item').count()) === historyCount, 'Panel search did not finish');
  }
  assert.equal(await panel.locator('.history-item').count(), 3);
  await panel.locator('#query').fill('');
  await screenshot(panel, 'sidepanel');
  await panel.locator('#clearHistory').click();
  await waitFor(async () => (await panel.locator('.history-item').count()) === 0, 'History was not cleared');
  await screenshot(panel, 'sidepanel-empty');
  passed('Narrow side panel opens searches, records history and clears it');
  await popup.locator('#disableAll').click();
  await waitFor(() => panel.locator('#searchBtn').isDisabled(), 'Panel did not observe disabled engines');
  passed('Side panel follows live engine changes and never substitutes a disabled provider');
  assert.deepEqual(report.pageErrors, []);
  passed('No uncaught extension-page errors');
})().catch(error => { report.failure = error.stack; process.exitCode = 1; }).finally(async () => {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, ...report }, null, 2));
});
