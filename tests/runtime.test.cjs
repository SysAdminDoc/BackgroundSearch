const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function background() {
  const events = {};
  const event = name => ({ addListener(fn) { events[name] = fn; } });
  const calls = [];
  const stored = { sync: {}, local: {} };
  const storage = area => ({
    async get(defaults) { return { ...(defaults || {}), ...structuredClone(stored[area]) }; },
    async set(data) { Object.assign(stored[area], structuredClone(data)); },
  });
  const chrome = {
    runtime: { id: 'owned-test', getURL: name => `chrome-extension://owned-test/${name}`,
      onMessage: event('message'), onStartup: event('startup'), onInstalled: event('installed') },
    tabs: { onCreated: event('created'), onActivated: event('activated'), onRemoved: event('removed'),
      async query() { return [{ id: 1, index: 0, windowId: 1, url: 'https://example.org/docs', title: 'Example docs' }]; },
      async create(opts) { calls.push(opts); return { ...opts, id: calls.length + 1 }; },
      async update(id, opts) { calls.push({ id, ...opts }); },
    },
    windows: { async create(opts) { calls.push(opts); return { id: 2 }; } },
    action: {}, contextMenus: { onClicked: event('contextClick'), async removeAll() {}, create() {} },
    omnibox: { onInputChanged: event('suggest'), onInputEntered: event('omnibox'), setDefaultSuggestion() {} },
    storage: { sync: storage('sync'), local: storage('local'), onChanged: event('storage') },
  };
  const ctx = vm.createContext({ chrome, URL, URLSearchParams, console, setTimeout, clearTimeout,
    fetch: () => new Promise(() => {}), structuredClone });
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), ctx);
  vm.runInContext(`ENGINES = ${fs.readFileSync(path.join(root, 'engines.json'), 'utf8')}; settings.enabledEngines = ['google', 'youtube', 'github'];`, ctx);
  return { ctx, calls, events, stored, run: code => vm.runInContext(code, ctx) };
}

test('documented short bangs resolve enabled YouTube and GitHub engines', () => {
  const bg = background();
  assert.equal(bg.run(`parseBang('!yt tabs').engine.id`), 'youtube');
  assert.equal(bg.run(`parseBang('!gh tabs').engine.id`), 'github');
});
test('bangs cannot select a disabled engine', () => {
  const bg = background();
  bg.run(`settings.enabledEngines = ['google']`);
  assert.equal(bg.run(`parseBang('!yt tabs')`), null);
});
test('all query and page placeholders are encoded', () => {
  const bg = background();
  assert.equal(bg.run(`expandTemplate('https://search.test/?q=%s&again=%s&host=%host&title=%title', 'a%26b', {url:'https://docs.test/path', title:'A & B'})`),
    'https://search.test/?q=a%26b&again=a%26b&host=docs.test&title=A%20%26%20B');
});
test('quick menu obtains bundled engines through an internal message', async () => {
  const bg = background();
  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No bundled-engine response')), 100);
    bg.events.message({ type: 'getEngines' }, { id: 'owned-test' }, value => { clearTimeout(timer); resolve(value); });
  });
  assert.equal(response.length, 29);
});
test('middle-click capture stops immediately when disabled', async () => {
  const handlers = {};
  let changed;
  const messages = [];
  const chrome = { storage: { sync: { async get() { return { bgTabsEnabled: true, middleClickCapture: true }; } },
    onChanged: { addListener(fn) { changed = fn; } } }, runtime: { async sendMessage(msg) { messages.push(msg); } } };
  const document = { addEventListener(name, fn) { handlers[name] = fn; } };
  const ctx = vm.createContext({ chrome, document, URL, window: { addEventListener() {} }, console });
  vm.runInContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), ctx);
  await new Promise(resolve => setImmediate(resolve));
  let prevented = false;
  const click = () => handlers.auxclick({ button: 1, target: { tagName: 'A', href: 'https://example.org' },
    preventDefault() { prevented = true; }, stopPropagation() {} });
  click(); assert.equal(prevented, true);
  changed({ middleClickCapture: { newValue: false } }, 'sync');
  prevented = false; click();
  assert.equal(prevented, false);
  assert.equal(messages.filter(item => item.type === 'openTab').length, 1);
});
test('background tab messages reject non-web URLs', async () => {
  const bg = background();
  bg.events.message({ type: 'openTab', url: 'javascript:alert(1)' }, { tab: { id: 1, index: 0 } }, () => {});
  await Promise.resolve();
  assert.equal(bg.calls.length, 0);
});
test('concurrent engine usage is not lost', async () => {
  const bg = background();
  await Promise.all([bg.run(`trackEngineUse('google')`), bg.run(`trackEngineUse('github')`)]);
  assert.equal(bg.stored.local.engineStats.google.length, 1);
  assert.equal(bg.stored.local.engineStats.github.length, 1);
});

test('POST navigation expands query and page fields without executing non-web URLs', () => {
  const bg = background();
  const value = bg.run(`engineNavigationUrl({url:'https://search.test/?query=%s',method:'POST',postParams:'q=%s&source=%host'}, 'A & B', {url:'https://docs.test/page'})`);
  const fields = new URLSearchParams(value.split('#')[1]);
  assert.equal(fields.get('action'), 'https://search.test/?query=A%20%26%20B');
  assert.equal(fields.get('q'), 'A & B');
  assert.equal(fields.get('source'), 'docs.test');
  assert.throws(() => bg.run(`engineNavigationUrl({url:'javascript:%s'}, 'test', {})`));
});

function popup() {
  const node = { addEventListener() {} };
  const ctx = vm.createContext({ chrome: { runtime: { getURL: name => name } }, URL, URLSearchParams, console,
    document: { getElementById() { return node; }, querySelectorAll() { return []; } },
    fetch: () => new Promise(() => {}) });
  vm.runInContext(fs.readFileSync(path.join(root, 'popup.js'), 'utf8'), ctx);
  return code => vm.runInContext(code, ctx);
}
for (const data of [null, [], { enabledEngines: 'google' }, { quickMenu: 'yes' }, { siteRules: [null] },
  { customEngines: [{ id: 'custom_test', name: 'Unsafe', url: 'javascript:%s' }] },
  { siteRules: [{ pattern: '[', type: 'regex', action: 'fg' }] }, { engineGroupMap: [] }]) {
  test(`config import rejects malformed data: ${JSON.stringify(data)}`, () => {
    assert.throws(() => popup()(`sanitizeImport(${JSON.stringify(data)})`));
  });
}
test('valid older configuration remains importable', () => {
  const run = popup();
  assert.equal(run(`sanitizeImport({enabledEngines:['google'], customEngines:[{id:'custom_123',name:'Example',url:'https://search.test/?q=%s'}]}).customEngines[0].name`), 'Example');
});
test('foreground results are activated after creation, without entering the background-force path', async () => {
  const bg = background();
  await bg.run(`createResultTab({url:'https://example.org',active:true})`);
  assert.equal(bg.calls[0].active, false);
  assert.equal(bg.calls[1].active, true);
  assert.equal(bg.calls[1].id, 2);
});
// `created` is what tabs.onCreated reports; `current` is what tabs.get returns once the tab is activated.
async function openFocusedTab(created, current = created) {
  const bg = background();
  bg.run(`chrome.tabs.get = async () => (${JSON.stringify(current)}); chrome.tabs.query = async () => [${JSON.stringify(current)}];`);
  bg.events.activated({ tabId: 1, windowId: 1 });
  bg.events.created({ windowId: 1, active: true, ...created });
  bg.events.activated({ tabId: created.id, windowId: 1 });
  await new Promise(resolve => setTimeout(resolve, 150));
  return bg.calls.filter(call => call.active === true);
}
for (const tab of [{ id: 7, pendingUrl: 'chrome://newtab/', url: '' }, { id: 7, url: 'chrome://newtab/' },
  { id: 7, url: 'about:newtab' }, { id: 7, url: 'about:home' }, { id: 7, url: 'about:privatebrowsing' },
  { id: 7, pendingUrl: 'edge://newtab/' }]) {
  test(`a tab opened with the + button keeps focus: ${tab.pendingUrl || tab.url}`, async () => {
    assert.deepEqual(await openFocusedTab(tab), []);
  });
}
test('a + button tab keeps focus when its URL appears only after creation', async () => {
  assert.deepEqual(await openFocusedTab({ id: 7, url: '' }, { id: 7, url: '', pendingUrl: 'chrome://newtab/' }), []);
});
test('a link opened in a focused new tab still returns focus to the reading tab', async () => {
  assert.deepEqual(await openFocusedTab({ id: 7, pendingUrl: 'https://example.org/next', openerTabId: 1 }), [{ id: 1, active: true }]);
});
test('a Firefox link tab that is reported inactive, then selected, still returns focus', async () => {
  assert.deepEqual(await openFocusedTab({ id: 7, url: 'about:blank', active: false, openerTabId: 1 },
    { id: 7, url: 'http://example.org/next', active: true }), [{ id: 1, active: true }]);
});
test('an explicit foreground result keeps focus when the browser reports it as a new tab', async () => {
  const bg = background();
  bg.ctx.hostEvents = bg.events;
  bg.run(`{
    const create = chrome.tabs.create, update = chrome.tabs.update;
    chrome.tabs.create = async opts => { const tab = await create(opts); hostEvents.created({ ...tab, windowId: 1 }); return tab; };
    chrome.tabs.update = async (id, opts) => { await update(id, opts); hostEvents.activated({ tabId: id, windowId: 1 }); };
    chrome.tabs.get = async id => ({ id, url: 'https://example.org/result', active: true });
    chrome.tabs.query = async () => [{ id: 2, windowId: 1 }];
  }`);
  bg.events.activated({ tabId: 1, windowId: 1 });
  await bg.run(`createResultTab({ url: 'https://example.org/result', active: true })`);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.deepEqual(bg.calls.filter(call => call.active === true), [{ id: 2, active: true }]);
});
test('only browser New Tab pages are exempt from background forcing', () => {
  const bg = background();
  for (const url of ['chrome://newtab/', 'chrome://new-tab-page/', 'chrome://new-tab-page-third-party/', 'edge://newtab/',
    'brave://newtab/', 'chrome-search://local-ntp/local-ntp.html', 'about:newtab', 'about:home', 'about:privatebrowsing']) {
    assert.equal(bg.run(`isNewTabPage(${JSON.stringify(url)})`), true, url);
  }
  for (const url of ['about:blank', 'chrome://settings/', 'chrome://newtabs/', 'about:homepage', 'https://newtab.example/',
    'https://example.org/?u=chrome://newtab/', '', null]) {
    assert.equal(bg.run(`isNewTabPage(${JSON.stringify(url)})`), false, String(url));
  }
});
test('focus history stays separate for each browser window', () => {
  const bg = background();
  bg.events.activated({ tabId: 20, windowId: 2 });
  bg.events.activated({ tabId: 10, windowId: 1 });
  assert.equal(bg.run('lastActiveTabs.get(2)'), 20);
  assert.equal(bg.run('lastActiveTabs.get(1)'), 10);
  bg.events.removed(10);
  assert.equal(bg.run('lastActiveTabs.has(1)'), false);
  assert.equal(bg.run('lastActiveTabs.get(2)'), 20);
});
