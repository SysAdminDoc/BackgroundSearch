import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';

export function findFirefoxBinary() {
  return [process.env.FIREFOX_BINARY, 'C:/Program Files/Mozilla Firefox/firefox.exe', '/usr/bin/firefox',
    '/Applications/Firefox.app/Contents/MacOS/firefox'].find(file => file && fs.existsSync(file));
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  for (let i = 0; i < 30 && child.exitCode === null && child.signalCode === null; i++) await delay(100);
  if (child.exitCode === null && child.signalCode === null) throw new Error('Owned geckodriver did not exit.');
}
export class WebDriverClient {
  static async start(binary, profileRoot, proxyPort) {
    const reservation = net.createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const client = new WebDriverClient();
    client.base = `http://127.0.0.1:${port}`;
    client.process = spawn(process.env.GECKODRIVER_BINARY || 'geckodriver', ['--port', String(port), '--binary', binary,
      '--allow-system-access', '--profile-root', profileRoot], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    client.process.stdout.on('data', data => { logs = (logs + data).slice(-5000); });
    client.process.stderr.on('data', data => { logs = (logs + data).slice(-5000); });
    let spawnError;
    client.process.on('error', error => { spawnError = error; });
    try {
      let ready = false;
      for (let i = 0; i < 100 && !ready; i++) {
        if (spawnError) throw spawnError;
        if (client.process.exitCode !== null) throw new Error(logs);
        try { await client.raw('GET', '/status'); ready = true; } catch { await delay(100); }
      }
      if (!ready) throw new Error('geckodriver did not become ready.');
      const session = await client.raw('POST', '/session', { capabilities: { alwaysMatch: {
        browserName: 'firefox', proxy: { proxyType: 'manual', httpProxy: `127.0.0.1:${proxyPort}`, sslProxy: `127.0.0.1:${proxyPort}` },
        'moz:firefoxOptions': { args: ['-headless'], prefs: {
          'browser.shell.checkDefaultBrowser': false, 'browser.startup.homepage_override.mstone': 'ignore',
          'browser.aboutwelcome.enabled': false, 'toolkit.telemetry.enabled': false,
          'datareporting.policy.dataSubmissionEnabled': false, 'app.update.auto': false,
        } },
      } } });
      client.session = session.sessionId;
      client.browserVersion = session.capabilities.browserVersion;
      return client;
    } catch (error) { await stopProcess(client.process); throw error; }
  }
  async raw(method, route, body) {
    const response = await fetch(this.base + route, { method, signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok || result.value?.error) throw new Error(result.value?.message || `WebDriver HTTP ${response.status}`);
    return result.value;
  }
  request(method, suffix, body) { return this.raw(method, `/session/${this.session}${suffix}`, body); }
  installAddon(directory) { return this.request('POST', '/moz/addon/install', { path: directory, temporary: true }); }
  setContext(context) { return this.request('POST', '/moz/context', { context }); }
  executeSync(script, args = []) { return this.request('POST', '/execute/sync', { script, args }); }
  async evaluate(context, fn, argument = null) {
    const result = await this.request('POST', '/execute/async', { script:
      `const done=arguments[arguments.length-1];Promise.resolve((${fn.toString()})(arguments[0])).then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));`, args: [argument] });
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }
  async openExtensionPage(url) {
    const previous = await this.request('GET', '/window/handles');
    await this.setContext('chrome');
    await this.executeSync(`const w=Services.wm.getMostRecentWindow('navigator:browser');const tab=w.gBrowser.addTab(arguments[0],{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()});w.gBrowser.selectedTab=tab;`, [url]);
    await this.setContext('content');
    const handles = await this.request('GET', '/window/handles');
    await this.request('POST', '/window', { handle: handles.find(handle => !previous.includes(handle)) });
    for (let i = 0; i < 100; i++) {
      if (await this.executeSync("return document.readyState === 'complete' && location.href === arguments[0];", [url])) return;
      await delay(100);
    }
    throw new Error('Extension page did not load.');
  }
  end() { return this.raw('DELETE', `/session/${this.session}`); }
}
