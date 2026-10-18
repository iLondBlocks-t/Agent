// eagler-debug.js — why doesn't the canvas appear? dump console, network, DOM.
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"); const fs = require("fs"); const path = require("path");
const ROOT = "/home/user/Agent/mc-lab/eagler/client/web/wasm";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
  ".epw": "application/octet-stream", ".png": "image/png" };
(async () => {
  await inflate("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/bin/al2023.tar.br");
  process.env.LD_LIBRARY_PATH = ["/tmp/al2023/lib", "/tmp", process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH = "/tmp/fonts";
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, req.url === "/" ? "/index.html" : req.url.split("?")[0]);
    if (!fs.existsSync(f)) { console.log("HTTP 404", req.url); res.writeHead(404); return res.end(); }
    console.log("HTTP 200", req.url, fs.statSync(f).size);
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(8124, "127.0.0.1", r));
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    executablePath: await chromium.executablePath(), headless: true,
    userDataDir: "/tmp/eagler-profile", defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  page.on("console", m => console.log("CONSOLE[" + m.type() + "]:", m.text().slice(0, 220)));
  page.on("pageerror", e => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("dialog", async d => { console.log("DIALOG:", d.message().slice(0, 200)); await d.dismiss(); });
  page.on("requestfailed", r => console.log("REQFAIL:", r.url().slice(0, 90), r.failure() && r.failure().errorText));
  await page.goto("http://127.0.0.1:8124/", { waitUntil: "load", timeout: 60000 });
  await new Promise(r => setTimeout(r, 8000));
  await page.mouse.click(640, 360); await page.keyboard.press("Space");
  console.log("GESTURE: click+space sent");
  await new Promise(r => setTimeout(r, 35000));
  const info = await page.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    bodyHTML: document.body.innerHTML.slice(0, 400),
    loaderCtx: typeof window.__eaglercraftXLoaderContextPre,
    webgl: (() => { try { const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl")); } catch (e) { return "err:" + e; } })(),
    wasmGC: typeof WebAssembly === "object" ? "present" : "absent",
  }));
  console.log("INFO:", JSON.stringify(info, null, 1).slice(0, 900));
  await page.screenshot({ path: "/home/user/Agent/mc-lab/eagler/debug.png" });
  await browser.close(); server.close(); console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
