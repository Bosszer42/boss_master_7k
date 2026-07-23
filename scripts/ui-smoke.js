'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const sourceElectronExe = path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const targetExe = process.env.BOSSMASTER_SMOKE_EXE
  ? path.resolve(process.env.BOSSMASTER_SMOKE_EXE)
  : sourceElectronExe;
const packagedTarget = path.resolve(targetExe).toLocaleLowerCase() !== path.resolve(sourceElectronExe).toLocaleLowerCase();
const debugPort = 9338;
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bossmaster-ui-smoke-'));
const screenshotPath = path.join(testRoot, 'writer-workspace.png');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function waitForPage() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const pages = await readJson(`http://127.0.0.1:${debugPort}/json/list`);
      const page = pages.find((item) => item.type === 'page' && /BOSSMASTER/i.test(item.title || ''));
      if (page?.webSocketDebuggerUrl) return page;
    } catch (_) {}
    await delay(250);
  }
  throw new Error('เปิดหน้า Electron ไม่สำเร็จภายใน 30 วินาที');
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params?.exceptionDetails?.text || 'Renderer exception');
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const send = async (method, params = {}) => {
    await ready;
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
  return { socket, send, exceptions };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Renderer evaluation failed');
  return result.result?.value;
}

async function main() {
  if (!fs.existsSync(targetExe)) throw new Error(`ไม่พบโปรแกรมสำหรับ Smoke Test: ${targetExe}`);
  const child = spawn(targetExe, [
    ...(packagedTarget ? [] : ['.']),
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${testRoot}`
  ], {
    cwd: repoRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BOSSMASTER_UI_SMOKE: '1' }
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  let cdp;
  try {
    const page = await waitForPage();
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    const initial = await evaluate(cdp, `({
      title: document.title,
      authVisible: !document.querySelector('#authScreen').classList.contains('hidden'),
      staticMissing: ['writerView','importWriterData','writerPackSelect','writerOutputContent'].filter(id => !document.getElementById(id))
    })`);
    if (!initial.authVisible || initial.staticMissing.length) throw new Error(`หน้าเริ่มต้นไม่สมบูรณ์: ${JSON.stringify(initial)}`);

    await evaluate(cdp, `(() => {
      document.querySelector('#displayName').value = 'UI Smoke Owner';
      document.querySelector('#username').value = 'ui_smoke_owner';
      document.querySelector('#password').value = 'SafeSmokePassword123!';
      document.querySelector('#authButton').click();
      return true;
    })()`);
    await delay(700);
    await evaluate(cdp, `(() => {
      document.querySelector('#username').value = 'ui_smoke_owner';
      document.querySelector('#password').value = 'SafeSmokePassword123!';
      document.querySelector('#authButton').click();
      return true;
    })()`);
    await delay(1800);
    const loggedIn = await evaluate(cdp, `!document.querySelector('#appShell').classList.contains('hidden')`);
    if (!loggedIn) throw new Error('เข้าสู่หน้าหลักด้วยฐานทดสอบไม่สำเร็จ');

    await evaluate(cdp, `document.querySelector('[data-mode="writer"]').click()`);
    await delay(600);
    const writer = await evaluate(cdp, `(() => {
      const view = document.querySelector('#writerView');
      const rect = view.getBoundingClientRect();
      const ids = [
        'importWriterData','randomizeWriterData','generateWriterPost','writerPackSelect',
        'writerSite','writerMode','writerFocus','writerTags','writerSourceContent',
        'writerOutputTitle','writerOutputMeta','writerOutputContent','validateWriterPost',
        'saveWriterDraft','exportWriterPost'
      ];
      return {
        visible: !view.classList.contains('hidden') && rect.width > 300 && rect.height > 300,
        missing: ids.filter(id => !document.getElementById(id)),
        activeTab: document.querySelector('[data-mode="writer"]').classList.contains('active'),
        packMessage: document.querySelector('#writerPackSummary').textContent,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      };
    })()`);
    if (!writer.visible || !writer.activeTab || writer.missing.length || writer.horizontalOverflow) {
      throw new Error(`Writer UI ไม่สมบูรณ์: ${JSON.stringify(writer)}`);
    }

    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    await delay(200);
    if (cdp.exceptions.length) throw new Error(`Renderer exception: ${cdp.exceptions.join(' | ')}`);
    console.log(JSON.stringify({ ok: true, initial, writer, screenshotPath }, null, 2));
  } finally {
    try { if (cdp?.socket?.readyState === WebSocket.OPEN) cdp.socket.close(); } catch (_) {}
    if (!child.killed) child.kill();
    await delay(500);
    if (stderr.trim()) console.error(stderr.trim());
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
