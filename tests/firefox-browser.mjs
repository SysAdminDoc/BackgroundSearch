import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebDriverClient, findFirefoxBinary, stopProcess } from '../tools/firefox-driver.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'test-results', `firefox-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
const report = { version: '2.7.1', isolatedHeadless: true, checks: [], blocked: [] };
const proxy = http.createServer((req, res) => { res.writeHead(200, {'Content-Type':'text/html'}); res.end('<!doctype html><title>Local Firefox fixture</title><p id="selection">CSS grid layout</p>'); });
proxy.on('connect', (req, socket) => { report.blocked.push(req.url); socket.on('error', error => { if (error.code !== 'ECONNRESET') report.proxyError = error.message; }); socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); });
let driver;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label) {
  for (let i = 0; i < 50; i++) { if (await driver.evaluate(null, fn)) return; await delay(100); }
  throw new Error(label);
}
try {
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const binary = findFirefoxBinary();
  assert.ok(binary, 'Firefox is required');
  driver = await WebDriverClient.start(binary, output, proxy.address().port);
  report.browser = driver.browserVersion;
  report.extensionId = await driver.installAddon(path.join(root, 'dist', 'BackgroundSearch-v2.7.1-firefox'));
  assert.equal(report.extensionId, 'backgroundsearch@sysadmindoc.com');
  report.checks.push('Firefox installs the actual temporary package under its existing Gecko identity');
  await driver.setContext('chrome');
  const origin = await driver.executeSync("return WebExtensionPolicy.getByID(arguments[0]).getURL('');", [report.extensionId]);
  await driver.setContext('content');
  await driver.openExtensionPage(origin + 'popup.html');
  await driver.request('POST', '/window/rect', { width: 440, height: 730 });
  await waitFor(() => document.querySelectorAll('#engineList .toggle-row').length === 29, 'Engine list did not load');
  const manifest = await driver.evaluate(null, () => browser.runtime.getManifest());
  assert.equal(manifest.version, '2.7.1');
  assert.equal(manifest.permissions.includes('sidePanel'), false);
  assert.equal(manifest.permissions.includes('tabGroups'), false);
  await driver.evaluate(null, () => {
    document.getElementById('quickMenu').click();
    document.getElementById('advancedSettings').open = true;
    document.querySelector('#themeCtrl [data-val="dark"]').click();
    document.getElementById('advancedSettings').open = false;
  });
  await waitFor(async () => (await browser.storage.sync.get('quickMenu')).quickMenu === true, 'Quick Menu did not persist');
  await delay(350);
  fs.writeFileSync(path.join(output, 'settings-firefox.png'), Buffer.from(await driver.request('GET', '/screenshot'), 'base64'));
  assert.equal(await driver.evaluate(null, () => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert.equal(await driver.evaluate(null, async () => (await browser.runtime.sendMessage({type:'getEngines'})).length), 29);
  report.checks.push('Firefox settings render without overflow, save through the controls and receive bundled engines');
  const newTab = await driver.evaluate(null, async () => {
    const result = await browser.runtime.sendMessage({type:'panelSearch',engineId:'google',text:'Firefox extension test'});
    return { result, tabs: (await browser.tabs.query({})).map(({url}) => url) };
  });
  assert.equal(newTab.result.ok, true);
  report.searchResponse = newTab;
  await waitFor(async () => (await browser.tabs.query({})).some(tab => (tab.url || tab.pendingUrl || '').includes('www.google.com/search?q=Firefox%20extension%20test')), 'Firefox search navigation did not settle');
  report.checks.push('The Firefox background opens a correctly encoded provider URL with external traffic blocked');
  await driver.evaluate(null, () => { document.getElementById('disableAll').click(); });
  await waitFor(async () => (await browser.storage.sync.get('enabledEngines')).enabledEngines.length === 0, 'Disable All did not save');
  const rejected = await driver.evaluate(null, () => browser.runtime.sendMessage({type:'panelSearch',engineId:'google',text:'must not search'}));
  assert.equal(rejected.ok, false);
  report.checks.push('Disabled providers are rejected by the Firefox background');
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  try { await driver?.end(); } catch (error) { report.teardownError = error.message; process.exitCode = 1; }
  try { await stopProcess(driver?.process); } catch (error) { report.teardownError = error.message; process.exitCode = 1; }
  await new Promise(resolve => proxy.close(resolve));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({output, ...report}, null, 2));
}
