import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs only against the workflow's isolated loopback preview. No external data or credentials.
const directory = await mkdtemp(join(tmpdir(), "xeomx-p0-browser-"));
const browser = spawn(
  process.env.P0_CHROME,
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    `--user-data-dir=${directory}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
let socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let targets;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
      break;
    } catch {
      await pause(100);
    }
  }
  const target = targets?.find((item) => item.type === "page");
  assert.ok(target, "Chrome debugger must start");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map();
  let id = 0;
  const exceptions = [];
  socket.addEventListener("message", (event) => {
    const result = JSON.parse(event.data);
    if (result.method === "Runtime.exceptionThrown")
      exceptions.push(result.params.exceptionDetails.text);
    const task = pending.get(result.id);
    if (task) {
      pending.delete(result.id);
      clearTimeout(task.timer);
      result.error ? task.reject(new Error(result.error.message)) : task.resolve(result.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const request = ++id;
      const timer = setTimeout(() => {
        pending.delete(request);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10000);
      pending.set(request, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: request, method, params }));
    });
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true });
    assert.ok(!result.exceptionDetails, "Browser evaluation failed");
    return result.result.value;
  }
  async function until(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(`UI condition timed out: ${expression}`);
  }
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:4173/en/inbox" });
  await until('document.querySelector("h1")?.textContent === "Inbox"');
  // Wait for hydrated handlers, then use the visible navigation entry.
  await pause(1200);
  await evaluate("document.querySelector('button[aria-label=\"Navigation\"]').click()");
  await until("!!document.querySelector('[role=\"dialog\"]')");
  await evaluate(
    '[...document.querySelectorAll(\'[role="dialog"] a\')].find(link => new URL(link.href).pathname.replace(/\\/$/, "").endsWith("/data")).click()',
  );
  await until(
    'document.querySelector("h1")?.textContent === "Dataset Studio" && !document.querySelector(\'[role="dialog"]\')',
  );
  assert.equal(
    await evaluate('document.querySelector("h1") === document.activeElement'),
    true,
    "Route heading should receive focus",
  );
  assert.equal(
    await evaluate("document.querySelector('[data-execution-authorized=\"false\"]') !== null"),
    true,
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Page.navigate", { url: "http://127.0.0.1:4173/fa/inbox" });
  await until(
    'document.documentElement.dir === "rtl" && document.querySelector("h1")?.textContent === "Inbox"',
  );
  await pause(500);
  assert.equal(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"),
    true,
    "Mobile RTL must not overflow horizontally",
  );
  assert.deepEqual(exceptions, [], "No uncaught browser exceptions");
  console.log(
    "P0_LAST_MILE_BROWSER_PASS navigation-dialog, route-action, focus, preview-boundary, mobile-RTL",
  );
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  await new Promise((resolve) => {
    if (browser.exitCode !== null) resolve();
    else {
      browser.once("exit", resolve);
      setTimeout(resolve, 2000).unref();
    }
  });
  await rm(directory, { recursive: true, force: true });
}
